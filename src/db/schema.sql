-- attendance-deno/src/db/schema.sql
-- 勤怠管理システム データベーススキーマ

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    isAdmin INTEGER NOT NULL DEFAULT 0
);

-- 勤怠記録テーブル
CREATE TABLE IF NOT EXISTS AttendanceRecord (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT (datetime('now')),
    checkIn TEXT,
    breakStart TEXT,
    breakEnd TEXT,
    checkOut TEXT,
    isAbsent INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

-- ユーザー状態テーブル
CREATE TABLE IF NOT EXISTS UserState (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    currentState TEXT NOT NULL,
    lastUpdated TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

-- 時刻修正申請テーブル
CREATE TABLE IF NOT EXISTS TimeEditRequest (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    recordId TEXT NOT NULL,
    field TEXT NOT NULL,
    oldValue TEXT,
    newValue TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES User(id),
    FOREIGN KEY (recordId) REFERENCES AttendanceRecord(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_attendance_userId ON AttendanceRecord(userId);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON AttendanceRecord(date);
CREATE INDEX IF NOT EXISTS idx_userstate_userId ON UserState(userId);
CREATE INDEX IF NOT EXISTS idx_timeedit_userId ON TimeEditRequest(userId);
CREATE INDEX IF NOT EXISTS idx_timeedit_status ON TimeEditRequest(status);
