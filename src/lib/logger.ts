// attendance-deno/src/lib/logger.ts
// CloudWatch連携対応のJSONログ出力ユーティリティ

import { ensureDirSync } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type LogAction =
  // 認証系
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "REGISTER"
  | "REGISTER_FAILED"
  // 勤怠操作系
  | "CHECK_IN"
  | "CHECK_OUT"
  | "RECHECK_IN"
  | "START_BREAK"
  | "END_BREAK"
  | "ABSENT"
  // 修正申請系
  | "EDIT_REQUEST"
  | "EDIT_REQUEST_APPROVE"
  | "EDIT_REQUEST_REJECT"
  // 管理者操作系
  | "ADMIN_EXPORT_CSV"
  | "ADMIN_VIEW_ATTENDANCE"
  // システム系
  | "SERVER_START"
  | "SERVER_ERROR"
  | "REQUEST_ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  user: string | null;
  userId: string | null;
  action: LogAction;
  message: string;
  error?: string;
  stack?: string;
  details?: Record<string, unknown>;
}

export interface LogContext {
  user?: string | null;
  userId?: string | null;
}

const LOG_DIR = Deno.env.get("LOG_DIR") || "./logs";

// ログディレクトリを確保
function ensureLogDir(): void {
  try {
    ensureDirSync(LOG_DIR);
  } catch (error) {
    console.error("Failed to create log directory:", error);
  }
}

// 今日の日付を取得（YYYY-MM-DD形式）
function getToday(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// ログファイルパスを取得
function getLogFilePath(): string {
  return `${LOG_DIR}/${getToday()}.log`;
}

// ログをファイルに書き込む
async function writeLog(entry: LogEntry): Promise<void> {
  ensureLogDir();

  const logLine = JSON.stringify(entry) + "\n";
  const filePath = getLogFilePath();

  try {
    await Deno.writeTextFile(filePath, logLine, { append: true });
  } catch (error) {
    console.error("Failed to write log:", error);
    // フォールバック: 標準出力に出力
    console.log(logLine);
  }
}

// ログをコンソールにも出力（開発時用）
function consoleLog(entry: LogEntry): void {
  const isDev = Deno.env.get("DENO_ENV") !== "production";
  if (isDev) {
    const color =
      entry.level === "ERROR"
        ? "\x1b[31m"
        : entry.level === "WARN"
          ? "\x1b[33m"
          : "\x1b[32m";
    const reset = "\x1b[0m";
    console.log(
      `${color}[${entry.level}]${reset} [${entry.user || "anonymous"}] [${entry.action}] ${entry.message}`,
    );
  }
}

// メインのログ関数
export async function log(
  level: LogLevel,
  action: LogAction,
  message: string,
  context?: LogContext,
  error?: Error,
  details?: Record<string, unknown>,
): Promise<void> {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    user: context?.user || null,
    userId: context?.userId || null,
    action,
    message,
  };

  if (error) {
    entry.error = error.name || "Error";
    entry.stack = error.stack;
  }

  if (details) {
    entry.details = details;
  }

  consoleLog(entry);
  await writeLog(entry);
}

// 便利メソッド
export const logger = {
  info: (
    action: LogAction,
    message: string,
    context?: LogContext,
    details?: Record<string, unknown>,
  ) => log("INFO", action, message, context, undefined, details),

  warn: (
    action: LogAction,
    message: string,
    context?: LogContext,
    details?: Record<string, unknown>,
  ) => log("WARN", action, message, context, undefined, details),

  error: (
    action: LogAction,
    message: string,
    context?: LogContext,
    error?: Error,
    details?: Record<string, unknown>,
  ) => log("ERROR", action, message, context, error, details),
};

// SessionUserからLogContextを作成するヘルパー
export function createLogContext(
  user: { id: string; name: string } | null | undefined,
): LogContext {
  if (!user) {
    return { user: null, userId: null };
  }
  return {
    user: user.name,
    userId: user.id,
  };
}
