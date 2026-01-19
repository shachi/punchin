// attendance-deno/main.ts
import { app } from "./src/app.ts";

const port = parseInt(Deno.env.get("PORT") || "3000");

console.log(`🚀 Server starting on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
