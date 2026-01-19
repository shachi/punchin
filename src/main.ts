// attendance-deno/src/main.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/deno";
import type { AppEnv } from "./types.ts";

// ルート
import { authRoutes } from "./routes/auth.ts";
import { attendanceRoutes } from "./routes/attendance.tsx";
import { adminRoutes } from "./routes/admin.tsx";
import { pageRoutes } from "./routes/pages.tsx";

// ミドルウェア
import { authMiddleware } from "./middleware/auth.ts";

// DB初期化
import { initDatabase } from "./db/init.ts";

// アプリケーション初期化
const app = new Hono<AppEnv>();

// ミドルウェア
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    credentials: true,
  }),
);

// 認証ミドルウェア（全ルートでユーザー情報をセット）
app.use("*", authMiddleware);

// 静的ファイル（staticディレクトリ）
app.use("/static/*", serveStatic({ root: "./" }));

// APIルート
app.route("/api/auth", authRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/admin", adminRoutes);

// ページルート
app.route("/", pageRoutes);

// エラーハンドリング
app.onError((err, c) => {
  console.error("Error:", err);

  // APIリクエストの場合はJSONで返す
  if (c.req.path.startsWith("/api/")) {
    return c.json(
      { success: false, message: "サーバーエラーが発生しました" },
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
      <div class="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 class="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
        <p class="text-gray-600 mb-4">申し訳ありません。問題が発生しました。</p>
        <a href="/" class="text-indigo-600 hover:underline">ホームに戻る</a>
      </div>
    </body>
    </html>`,
    500,
  );
});

// 404ハンドリング
app.notFound((c) => {
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

// サーバー起動
const port = parseInt(Deno.env.get("PORT") || "5150");

// DB初期化
console.log("Initializing database...");
await initDatabase();
console.log("Database initialized.");

console.log(`Server starting on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
