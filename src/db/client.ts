// attendance-deno/src/db/client.ts
import { Database } from "@db/sqlite";

const DB_PATH = Deno.env.get("DATABASE_URL") || "./dev.db";

// シングルトンパターンでDB接続を管理
let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ユーティリティ: UUIDを生成
export function generateId(): string {
  return crypto.randomUUID();
}

// ユーティリティ: 現在時刻をISO形式で取得
export function nowISO(): string {
  return new Date().toISOString();
}
