// attendance-deno/src/middleware/auth.ts
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken, getSessionUser } from "../lib/jwt.ts";
import type { SessionUser } from "../types.ts";

// コンテキストに追加する型
declare module "hono" {
  interface ContextVariableMap {
    user: SessionUser | null;
  }
}

// 認証状態を確認するミドルウェア（認証必須ではない）
export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, "auth_token");
  
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      c.set("user", getSessionUser(payload));
    } else {
      c.set("user", null);
    }
  } else {
    c.set("user", null);
  }
  
  await next();
}

// 認証必須ミドルウェア
export async function requireAuth(c: Context, next: Next) {
  const user = c.get("user");
  
  if (!user) {
    // APIリクエストの場合はJSONエラー
    if (c.req.path.startsWith("/api/")) {
      return c.json({ success: false, message: "認証が必要です" }, 401);
    }
    // ページリクエストの場合はリダイレクト
    return c.redirect("/login");
  }
  
  await next();
}

// 管理者権限必須ミドルウェア
export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user");
  
  if (!user) {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ success: false, message: "認証が必要です" }, 401);
    }
    return c.redirect("/login");
  }
  
  if (!user.isAdmin) {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ success: false, message: "管理者権限が必要です" }, 403);
    }
    return c.redirect("/dashboard");
  }
  
  await next();
}
