// attendance-deno/src/app.ts
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { authMiddleware } from "./middleware/auth.ts";
import { authRoutes } from "./routes/auth.ts";
import { attendanceRoutes } from "./routes/attendance.tsx";
import { adminRoutes } from "./routes/admin.tsx";
import { pageRoutes } from "./routes/pages.tsx";
import type { AppEnv } from "./types.ts";

export const app = new Hono<AppEnv>();

// ミドルウェア
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", authMiddleware);

// 静的ファイル
app.use("/static/*", serveStatic({ root: "./" }));

// ルート
app.route("/api/auth", authRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/admin", adminRoutes);
app.route("/", pageRoutes);

// エラーハンドリング
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    { success: false, message: "サーバーエラーが発生しました" },
    500,
  );
});

app.notFound((c) => {
  return c.html(
    `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>404 - ページが見つかりません</title>
    </head>
    <body class="flex items-center justify-center min-h-screen bg-gray-100">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-800">404</h1>
        <p class="mt-2 text-gray-600">ページが見つかりません</p>
        <a href="/" class="mt-4 inline-block text-indigo-600 hover:underline">ホームへ戻る</a>
      </div>
    </body>
    </html>`,
    404,
  );
});
