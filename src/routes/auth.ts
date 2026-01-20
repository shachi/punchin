// attendance-deno/src/routes/auth.ts
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { getDb, generateId } from "../db/client.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { createToken } from "../lib/jwt.ts";
import { logger, createLogContext } from "../lib/logger.ts";
import type { AppEnv, User } from "../types.ts";

export const authRoutes = new Hono<AppEnv>();

// ログイン
authRoutes.post("/login", async (c) => {
  const returnError = async (message: string, email?: string, user?: User) => {
    await logger.warn(
      "LOGIN_FAILED",
      message,
      user
        ? createLogContext({ id: user.id, name: user.name })
        : { user: email || null, userId: null },
    );
    if (c.req.header("HX-Request")) {
      return c.json({ success: false, message }, 400);
    }
    return c.redirect("/login?error=" + encodeURIComponent(message));
  };

  try {
    const body = await c.req.parseBody();
    const email = body.email as string;
    const password = body.password as string;

    if (!email || !password) {
      return await returnError(
        "メールアドレスとパスワードを入力してください",
        email,
      );
    }

    // ユーザー検索
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM User WHERE email = ?");
    const user = stmt.get(email) as User | undefined;

    if (!user) {
      return await returnError(
        "メールアドレスまたはパスワードが正しくありません",
        email,
      );
    }

    // パスワード検証
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return await returnError(
        "メールアドレスまたはパスワードが正しくありません",
        email,
        user,
      );
    }

    // JWT生成
    const token = await createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    });

    // Cookie設定
    setCookie(c, "auth_token", token, {
      httpOnly: true,
      secure: Deno.env.get("DENO_ENV") === "production",
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 7, // 7日
      path: "/",
    });

    // ログイン成功をログ
    await logger.info(
      "LOGIN",
      "ログイン成功",
      createLogContext({ id: user.id, name: user.name }),
    );

    // htmxリクエストの場合はリダイレクトヘッダーを返す
    if (c.req.header("HX-Request")) {
      c.header("HX-Redirect", user.isAdmin ? "/admin" : "/dashboard");
      return c.text("");
    }

    // 通常のフォーム送信の場合はリダイレクト
    return c.redirect(user.isAdmin ? "/admin" : "/dashboard");
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await logger.error(
      "LOGIN_FAILED",
      "ログイン中にエラーが発生しました",
      { user: null, userId: null },
      err,
    );

    if (c.req.header("HX-Request")) {
      return c.json(
        { success: false, message: "ログイン中にエラーが発生しました" },
        500,
      );
    }
    return c.redirect(
      "/login?error=" + encodeURIComponent("ログイン中にエラーが発生しました"),
    );
  }
});

// ログアウト
authRoutes.post("/logout", async (c) => {
  const user = c.get("user");

  // ログアウトをログ
  await logger.info("LOGOUT", "ログアウト", createLogContext(user));

  deleteCookie(c, "auth_token", { path: "/" });

  if (c.req.header("HX-Request")) {
    c.header("HX-Redirect", "/login");
    return c.text("");
  }

  return c.redirect("/login");
});

// 登録
authRoutes.post("/register", async (c) => {
  try {
    const body = await c.req.parseBody();
    const name = body.name as string;
    const email = body.email as string;
    const password = body.password as string;

    // バリデーション
    if (!name || !email || !password) {
      await logger.warn("REGISTER_FAILED", "すべての項目を入力してください", {
        user: email || null,
        userId: null,
      });
      return c.json(
        { success: false, message: "すべての項目を入力してください" },
        400,
      );
    }

    if (password.length < 6) {
      await logger.warn(
        "REGISTER_FAILED",
        "パスワードは6文字以上で入力してください",
        { user: email, userId: null },
      );
      return c.json(
        { success: false, message: "パスワードは6文字以上で入力してください" },
        400,
      );
    }

    const db = getDb();

    // メールアドレスの重複チェック
    const existingStmt = db.prepare("SELECT id FROM User WHERE email = ?");
    const existing = existingStmt.get(email);

    if (existing) {
      await logger.warn(
        "REGISTER_FAILED",
        "このメールアドレスは既に使用されています",
        { user: email, userId: null },
      );
      return c.json(
        { success: false, message: "このメールアドレスは既に使用されています" },
        400,
      );
    }

    // パスワードハッシュ化
    const hashedPassword = await hashPassword(password);
    const userId = generateId();

    // トランザクションでユーザーとUserStateを作成
    db.exec("BEGIN TRANSACTION");
    try {
      // ユーザー作成
      const insertUser = db.prepare(
        "INSERT INTO User (id, name, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)",
      );
      insertUser.run(userId, name, email, hashedPassword, 0);

      // UserState作成
      const insertState = db.prepare(
        "INSERT INTO UserState (id, userId, currentState) VALUES (?, ?, ?)",
      );
      insertState.run(generateId(), userId, "not_checked_in");

      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }

    // 登録成功をログ
    await logger.info(
      "REGISTER",
      "新規ユーザー登録成功",
      createLogContext({ id: userId, name }),
    );

    if (c.req.header("HX-Request")) {
      c.header("HX-Redirect", "/login?registered=true");
      return c.text("");
    }

    // 通常のフォーム送信の場合はリダイレクト
    return c.redirect("/login?registered=true");
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await logger.error(
      "REGISTER_FAILED",
      "登録中にエラーが発生しました",
      { user: null, userId: null },
      err,
    );

    // エラー時もリダイレクト（エラーメッセージ付き）
    if (c.req.header("HX-Request")) {
      return c.json(
        { success: false, message: "登録中にエラーが発生しました" },
        500,
      );
    }
    return c.redirect(
      "/register?error=" + encodeURIComponent("登録中にエラーが発生しました"),
    );
  }
});
