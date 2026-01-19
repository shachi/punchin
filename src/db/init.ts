// attendance-deno/src/db/init.ts
import { getDb, closeDb } from "./client.ts";

async function initDatabase() {
  console.log("データベースを初期化しています...");
  
  const db = getDb();
  
  // スキーマファイルを読み込んで実行
  const schemaPath = new URL("./schema.sql", import.meta.url);
  const schema = await Deno.readTextFile(schemaPath);
  
  db.exec(schema);
  
  console.log("データベースの初期化が完了しました。");
  closeDb();
}

if (import.meta.main) {
  await initDatabase();
}

export { initDatabase };
