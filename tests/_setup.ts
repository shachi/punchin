// tests/_setup.ts
// テスト用の共通セットアップ
//
// - 一時ディレクトリに専用のSQLite DBとログディレクトリを作る
// - src/db/client.ts は import 時に DATABASE_URL を読むので、
//   環境変数を設定してから app / client を動的 import する
// - SLACK_WEBHOOK_URL は必ず外す（テストでSlackに飛ばさない）

import type { Hono } from "hono";
import type { AppEnv } from "../src/types.ts";

type DbModule = typeof import("../src/db/client.ts");
type JwtModule = typeof import("../src/lib/jwt.ts");

export interface TestContext {
  app: Hono<AppEnv>;
  db: ReturnType<DbModule["getDb"]>;
  closeDb: DbModule["closeDb"];
  tmpDir: string;
  adminCookie: string;
  userCookie: string;
  adminId: string;
  userId: string;
}

let ctx: TestContext | null = null;

export async function setupTestApp(): Promise<TestContext> {
  if (ctx) return ctx;

  const tmpDir = await Deno.makeTempDir({ prefix: "punchin-test-" });
  Deno.env.set("DATABASE_URL", `${tmpDir}/test.db`);
  Deno.env.set("LOG_DIR", `${tmpDir}/logs`);
  Deno.env.set("DENO_ENV", "test"); // アクセスログ・コンソールログを抑える
  Deno.env.delete("SLACK_WEBHOOK_URL");

  const { getDb, closeDb }: DbModule = await import("../src/db/client.ts");
  const { createToken }: JwtModule = await import("../src/lib/jwt.ts");
  const { app } = await import("../src/app.ts");

  const db = getDb();
  const schema = await Deno.readTextFile(
    new URL("../src/db/schema.sql", import.meta.url),
  );
  db.exec(schema);

  const adminId = "test-admin";
  const userId = "test-user";
  db.prepare(
    "INSERT INTO User (id, name, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)",
  ).run(adminId, "テスト管理者", "admin@example.com", "x", 1);
  db.prepare(
    "INSERT INTO User (id, name, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, "山田太郎", "yamada@example.com", "x", 0);

  const adminToken = await createToken({
    id: adminId,
    email: "admin@example.com",
    name: "テスト管理者",
    isAdmin: true,
  });
  const userToken = await createToken({
    id: userId,
    email: "yamada@example.com",
    name: "山田太郎",
    isAdmin: false,
  });

  ctx = {
    app,
    db,
    closeDb,
    tmpDir,
    adminCookie: `auth_token=${adminToken}`,
    userCookie: `auth_token=${userToken}`,
    adminId,
    userId,
  };
  return ctx;
}

// 勤怠・申請データを空にする（テストごとに呼ぶ）
export function resetData(t: TestContext): void {
  t.db.exec("DELETE FROM TimeEditRequest");
  t.db.exec("DELETE FROM AttendanceRecord");
  t.db.exec("DELETE FROM UserState");
}

export interface SeedRecord {
  id: string;
  userId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
}

export function insertRecord(t: TestContext, r: SeedRecord): void {
  t.db.prepare(
    `INSERT INTO AttendanceRecord (id, userId, date, checkIn, checkOut, breakStart, breakEnd, isAbsent)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    r.id,
    r.userId,
    r.date,
    r.checkIn ?? null,
    r.checkOut ?? null,
    r.breakStart ?? null,
    r.breakEnd ?? null,
  );
}

export interface SeedRequest {
  id: string;
  userId: string;
  recordId: string;
  field: "checkIn" | "checkOut" | "breakStart" | "breakEnd";
  oldValue: string | null;
  newValue: string;
  reason?: string;
  status?: "pending" | "approved" | "rejected";
}

export function insertRequest(t: TestContext, r: SeedRequest): void {
  const now = new Date().toISOString();
  t.db.prepare(
    `INSERT INTO TimeEditRequest (id, userId, recordId, field, oldValue, newValue, reason, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    r.id,
    r.userId,
    r.recordId,
    r.field,
    r.oldValue,
    r.newValue,
    r.reason ?? "打刻忘れ",
    r.status ?? "pending",
    now,
    now,
  );
}

export async function teardownTestApp(): Promise<void> {
  if (!ctx) return;
  ctx.closeDb();
  await Deno.remove(ctx.tmpDir, { recursive: true }).catch(() => {});
  ctx = null;
}
