// attendance-deno/src/db/seed.ts
import { getDb, closeDb, generateId, nowISO } from "./client.ts";
import { initDatabase } from "./init.ts";
import { hashPassword } from "../lib/password.ts";

async function seed() {
  console.log("シードデータを投入しています...");
  
  // まずDBを初期化
  await initDatabase();
  
  const db = getDb();
  
  // 管理者ユーザーを作成
  const adminId = generateId();
  const hashedPassword = await hashPassword("admin123");
  const now = nowISO();
  
  // 既存の管理者を確認
  const existing = db.prepare(
    "SELECT id FROM User WHERE email = ?"
  ).get("admin@example.com");
  
  if (!existing) {
    db.prepare(`
      INSERT INTO User (id, name, email, password, isAdmin)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminId, "管理者", "admin@example.com", hashedPassword, 1);
    
    // ユーザー状態も作成
    db.prepare(`
      INSERT INTO UserState (id, userId, currentState, lastUpdated)
      VALUES (?, ?, ?, ?)
    `).run(generateId(), adminId, "not_checked_in", now);
    
    console.log("管理者ユーザーを作成しました:");
    console.log("  Email: admin@example.com");
    console.log("  Password: admin123");
  } else {
    console.log("管理者ユーザーは既に存在します。");
  }
  
  console.log("シードデータの投入が完了しました。");
  closeDb();
}

if (import.meta.main) {
  await seed();
}

export { seed };
