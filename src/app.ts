// attendance-deno/src/app.ts
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { authMiddleware } from "./middleware/auth.ts";
import { authRoutes } from "./routes/auth.ts";
import { attendanceRoutes } from "./routes/attendance.tsx";
import { adminRoutes } from "./routes/admin.tsx";
import { pageRoutes } from "./routes/pages.tsx";
import { logger, createLogContext } from "./lib/logger.ts";
import type { AppEnv } from "./types.ts";

export const app = new Hono<AppEnv>();

// ミドルウェア
app.use("*", honoLogger());
app.use("*", secureHeaders());
app.use("*", authMiddleware);

// 静的ファイル
app.use("/static/*", serveStatic({ root: "./" }));

// ルート
app.route("/api/auth", authRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/admin", adminRoutes);
app.route("/", pageRoutes);

// エラーハンドリング（詳細なログ出力付き）
app.onError(async (err, c) => {
  const user = c.get("user");
  const logCtx = createLogContext(user);

  // エラーの詳細情報を収集
  const errorDetails = {
    path: c.req.path,
    method: c.req.method,
    userAgent: c.req.header("User-Agent") || "unknown",
    referer: c.req.header("Referer") || "unknown",
  };

  // エラーをログに記録
  await logger.error(
    "SERVER_ERROR",
    `サーバーエラー: ${err.message}`,
    logCtx,
    err instanceof Error ? err : new Error(String(err)),
    errorDetails,
  );

  // APIリクエストの場合はJSONで返す
  if (c.req.path.startsWith("/api/")) {
    return c.json(
      {
        success: false,
        message: "サーバーエラーが発生しました",
        // 本番環境ではエラー詳細を隠す
        ...(Deno.env.get("DENO_ENV") !== "production" && {
          error: err.message,
        }),
      },
      500,
    );
  }

  // HTMLページの場合はエラーページを返す
  return c.html(
    `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>エラー</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <h1 class="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
        <p class="text-gray-600 mb-4">申し訳ありません。問題が発生しました。</p>
        <p class="text-gray-500 text-sm mb-4">しばらく時間をおいてから再度お試しください。</p>
        <a href="/" class="text-indigo-600 hover:underline">ホームに戻る</a>
      </div>
    </body>
    </html>`,
    500,
  );
});

// 404ハンドリング
app.notFound(async (c) => {
  const user = c.get("user");
  const logCtx = createLogContext(user);

  // 404をログに記録（WARNレベル）
  await logger.warn("REQUEST_ERROR", `404 Not Found: ${c.req.path}`, logCtx, {
    path: c.req.path,
    method: c.req.method,
    userAgent: c.req.header("User-Agent") || "unknown",
  });

  if (c.req.path.startsWith("/api/")) {
    return c.json({ success: false, message: "Not Found" }, 404);
  }

  return c.html(
    `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ページが見つかりません</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 class="text-2xl font-bold text-gray-800 mb-4">ページが見つかりません</h1>
        <p class="text-gray-600 mb-4">お探しのページは存在しないか、移動された可能性があります。</p>
        <a href="/" class="text-indigo-600 hover:underline">ホームに戻る</a>
      </div>
    </body>
    </html>`,
    404,
  );
});

// サーバー起動ログ出力関数をエクスポート
export async function logServerStart(port: number): Promise<void> {
  await logger.info(
    "SERVER_START",
    `サーバーを起動しました (ポート: ${port})`,
    { user: null, userId: null },
  );
}
