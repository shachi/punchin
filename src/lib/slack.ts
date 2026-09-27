// attendance-deno/src/lib/slack.ts
// Slack Incoming Webhook 通知ユーティリティ
//
// 環境変数:
//   SLACK_WEBHOOK_URL  … Incoming Webhook URL（未設定なら通知しない）
//   APP_URL            … 承認ページへのリンク用ベースURL（任意 例: https://punchin.example.com）

import dayjs from "./dayjs.ts";
import { type LogContext, logger } from "./logger.ts";

const FIELD_LABELS: Record<string, string> = {
  checkIn: "出社時間",
  checkOut: "退社時間",
  breakStart: "休憩開始時間",
  breakEnd: "休憩終了時間",
};

// ISO → JST "H:mm"（null は "未打刻"）
function toJstTime(iso: string | null | undefined): string {
  if (!iso) return "未打刻";
  const d = dayjs(iso);
  if (!d.isValid()) return "-";
  return d.tz("Asia/Tokyo").format("H:mm");
}

// ISO → JST "YYYY/MM/DD (ddd)"
function toJstDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = dayjs(iso);
  if (!d.isValid()) return "-";
  return d.tz("Asia/Tokyo").format("YYYY/MM/DD (ddd)");
}

export interface EditRequestNotifyParams {
  userName: string;
  recordDate: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
}

// Webhookへ送信（内部用）
async function postToSlack(
  payload: Record<string, unknown>,
  logCtx: LogContext,
): Promise<void> {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return; // 未設定なら何もしない

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await logger.warn("SLACK_NOTIFY", "Slack通知に失敗しました", logCtx, {
        status: res.status,
        body,
      });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await logger.warn(
      "SLACK_NOTIFY",
      "Slack通知でエラーが発生しました",
      logCtx,
      {
        error: err.message,
      },
    );
  }
}

/**
 * 時刻修正申請をSlackに通知する
 * 呼び出し側では await せずに投げっぱなしでOK（申請処理をブロックしない）
 */
export function notifyEditRequest(
  params: EditRequestNotifyParams,
  logCtx: LogContext,
): Promise<void> {
  const fieldLabel = FIELD_LABELS[params.field] || params.field;
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");

  const lines = [
    ":clock3: *時刻修正申請がありました*",
    `申請者: ${params.userName}`,
    `対象日: ${toJstDate(params.recordDate)}`,
    `項目: ${fieldLabel}`,
    `現在値 → 修正値: ${toJstTime(params.oldValue)} → ${
      toJstTime(params.newValue)
    }`,
    `理由: ${params.reason}`,
  ];
  if (appUrl) {
    lines.push(
      `承認ページ: <${appUrl}/admin/edit-requests|時刻修正申請一覧を開く>`,
    );
  }

  return postToSlack({ text: lines.join("\n") }, logCtx);
}
