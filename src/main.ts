// attendance-deno/main.ts
import { app, logServerStart } from "./src/app.ts";

const port = parseInt(Deno.env.get("PORT") || "3000");

console.log(`🚀 Server starting on http://localhost:${port}`);

// サーバー起動をログに記録
await logServerStart(port);

Deno.serve({ port }, app.fetch);
