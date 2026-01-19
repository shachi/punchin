// attendance-deno/src/routes/attendance.ts
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { getDb, generateId, nowISO } from "../db/client.ts";
import { getBusinessDayRange } from "../lib/dayjs.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { AppEnv, UserState, AttendanceRecord } from "../types.ts";
import { DashboardContent } from "../views/pages/DashboardContent.tsx";

export const attendanceRoutes = new Hono<AppEnv>();

// 全ルートで認証必須
attendanceRoutes.use("*", requireAuth);

// ユーザーの状態とレコードを取得するヘルパー
function getUserStateAndRecord(userId: string) {
  const db = getDb();
  const stateStmt = db.prepare("SELECT * FROM UserState WHERE userId = ?");
  const userState = stateStmt.get(userId) as UserState | undefined;

  const { start, end } = getBusinessDayRange();
  const recordStmt = db.prepare(
    "SELECT * FROM AttendanceRecord WHERE userId = ? AND date >= ? AND date <= ?",
  );
  const record = recordStmt.get(
    userId,
    start.toISOString(),
    end.toISOString(),
  ) as AttendanceRecord | undefined;

  return { userState, record };
}

// HTMXリクエストかどうかを判定
function isHtmxRequest(c: any): boolean {
  // 複数の方法でHX-Requestヘッダーを確認
  const hxRequest = c.req.header("HX-Request") || c.req.header("hx-request");

  // HX-Targetヘッダーも確認（HTMXが送るもう一つのヘッダー）
  const hxTarget = c.req.header("HX-Target") || c.req.header("hx-target");

  // 生のヘッダーからも確認
  const rawHeaders = c.req.raw?.headers;
  const rawHxRequest =
    rawHeaders?.get("HX-Request") || rawHeaders?.get("hx-request");

  console.log(
    "Headers check - hxRequest:",
    hxRequest,
    "hxTarget:",
    hxTarget,
    "rawHxRequest:",
    rawHxRequest,
  );

  return hxRequest === "true" || rawHxRequest === "true" || !!hxTarget;
}

// HTMXレスポンス用のヘルパー
function htmxResponse(
  c: any,
  userId: string,
  message: { text: string; type: "success" | "error" | "info" | "warning" },
) {
  const { userState, record } = getUserStateAndRecord(userId);
  const currentState = (userState?.currentState || "not_checked_in") as any;

  // 修正申請を取得
  let editRequests: Array<{ id: string; field: string; status: string }> = [];
  if (record) {
    const db = getDb();
    const stmt = db.prepare(
      "SELECT id, field, status FROM TimeEditRequest WHERE userId = ? AND recordId = ? ORDER BY createdAt DESC",
    );
    editRequests = stmt.all(userId, record.id) as any[];
  }

  return c.html(
    <DashboardContent
      currentState={currentState}
      record={record}
      message={message}
      editRequests={editRequests}
    />,
  );
}

// 出社
attendanceRoutes.post("/check-in", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { userState, record } = getUserStateAndRecord(user.id);

  if (userState?.currentState !== "not_checked_in") {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "既に出社済みです",
        type: "error",
      });
    }
    return c.json(
      {
        success: false,
        message: "既に出社済みです",
        currentState: userState?.currentState,
      },
      400,
    );
  }

  const now = nowISO();
  const { start } = getBusinessDayRange();

  // 既存レコードがあれば更新、なければ作成
  if (record) {
    const updateRecord = db.prepare(
      "UPDATE AttendanceRecord SET checkIn = ?, isAbsent = 0 WHERE id = ?",
    );
    updateRecord.run(now, record.id);
  } else {
    const insertRecord = db.prepare(
      "INSERT INTO AttendanceRecord (id, userId, date, checkIn, isAbsent) VALUES (?, ?, ?, ?, 0)",
    );
    insertRecord.run(generateId(), user.id, start.toISOString(), now);
  }

  // 状態更新
  const updateState = db.prepare(
    "UPDATE UserState SET currentState = ?, lastUpdated = ? WHERE userId = ?",
  );
  updateState.run("checked_in", now, user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, { text: "出社しました", type: "success" });
  }
  return c.json({
    success: true,
    message: "出社しました",
    currentState: "checked_in",
  });
});

// 休憩開始
attendanceRoutes.post("/start-break", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { userState, record } = getUserStateAndRecord(user.id);

  if (userState?.currentState !== "checked_in") {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "出社状態でないと休憩を開始できません",
        type: "error",
      });
    }
    return c.json(
      { success: false, message: "出社状態でないと休憩を開始できません" },
      400,
    );
  }

  if (!record) {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "出社記録が見つかりません",
        type: "error",
      });
    }
    return c.json({ success: false, message: "出社記録が見つかりません" }, 400);
  }

  const now = nowISO();
  const updateRecord = db.prepare(
    "UPDATE AttendanceRecord SET breakStart = ? WHERE id = ?",
  );
  updateRecord.run(now, record.id);

  const updateState = db.prepare(
    "UPDATE UserState SET currentState = ?, lastUpdated = ? WHERE userId = ?",
  );
  updateState.run("on_break", now, user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, {
      text: "休憩を開始しました",
      type: "success",
    });
  }
  return c.json({
    success: true,
    message: "休憩を開始しました",
    currentState: "on_break",
  });
});

// 休憩終了
attendanceRoutes.post("/end-break", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { userState, record } = getUserStateAndRecord(user.id);

  if (userState?.currentState !== "on_break") {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "休憩中でないと休憩を終了できません",
        type: "error",
      });
    }
    return c.json(
      { success: false, message: "休憩中でないと休憩を終了できません" },
      400,
    );
  }

  if (!record) {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "出社記録が見つかりません",
        type: "error",
      });
    }
    return c.json({ success: false, message: "出社記録が見つかりません" }, 400);
  }

  const now = nowISO();
  const updateRecord = db.prepare(
    "UPDATE AttendanceRecord SET breakEnd = ? WHERE id = ?",
  );
  updateRecord.run(now, record.id);

  const updateState = db.prepare(
    "UPDATE UserState SET currentState = ?, lastUpdated = ? WHERE userId = ?",
  );
  updateState.run("checked_in", now, user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, {
      text: "休憩を終了しました",
      type: "success",
    });
  }
  return c.json({
    success: true,
    message: "休憩を終了しました",
    currentState: "checked_in",
  });
});

// 退社
attendanceRoutes.post("/check-out", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { userState, record } = getUserStateAndRecord(user.id);

  if (userState?.currentState !== "checked_in") {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "出社状態でないと退社できません",
        type: "error",
      });
    }
    return c.json(
      { success: false, message: "出社状態でないと退社できません" },
      400,
    );
  }

  if (!record) {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "出社記録が見つかりません",
        type: "error",
      });
    }
    return c.json({ success: false, message: "出社記録が見つかりません" }, 400);
  }

  const now = nowISO();
  const updateRecord = db.prepare(
    "UPDATE AttendanceRecord SET checkOut = ? WHERE id = ?",
  );
  updateRecord.run(now, record.id);

  const updateState = db.prepare(
    "UPDATE UserState SET currentState = ?, lastUpdated = ? WHERE userId = ?",
  );
  updateState.run("checked_out", now, user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, { text: "退社しました", type: "success" });
  }
  return c.json({
    success: true,
    message: "退社しました",
    currentState: "checked_out",
  });
});

// 再出社
attendanceRoutes.post("/recheck-in", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { userState } = getUserStateAndRecord(user.id);

  if (userState?.currentState !== "checked_out") {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "退社状態でないと再出社できません",
        type: "error",
      });
    }
    return c.json(
      { success: false, message: "退社状態でないと再出社できません" },
      400,
    );
  }

  const now = nowISO();
  const updateState = db.prepare(
    "UPDATE UserState SET currentState = ?, lastUpdated = ? WHERE userId = ?",
  );
  updateState.run("checked_in", now, user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, {
      text: "再出社しました",
      type: "success",
    });
  }
  return c.json({
    success: true,
    message: "再出社しました",
    currentState: "checked_in",
  });
});

// 欠勤
attendanceRoutes.post("/absent", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { userState, record } = getUserStateAndRecord(user.id);

  if (userState?.currentState !== "not_checked_in") {
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "出社登録後は欠勤にできません",
        type: "error",
      });
    }
    return c.json(
      { success: false, message: "出社登録後は欠勤にできません" },
      400,
    );
  }

  const now = nowISO();
  const { start } = getBusinessDayRange();

  if (record) {
    const updateRecord = db.prepare(
      "UPDATE AttendanceRecord SET isAbsent = 1 WHERE id = ?",
    );
    updateRecord.run(record.id);
  } else {
    const insertRecord = db.prepare(
      "INSERT INTO AttendanceRecord (id, userId, date, isAbsent) VALUES (?, ?, ?, 1)",
    );
    insertRecord.run(generateId(), user.id, start.toISOString());
  }

  const updateState = db.prepare(
    "UPDATE UserState SET currentState = ?, lastUpdated = ? WHERE userId = ?",
  );
  updateState.run("absent", now, user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, {
      text: "欠勤として記録しました",
      type: "success",
    });
  }
  return c.json({
    success: true,
    message: "欠勤として記録しました",
    currentState: "absent",
  });
});

// 状態取得API
attendanceRoutes.get("/state", async (c) => {
  const user = c.get("user")!;
  const { userState, record } = getUserStateAndRecord(user.id);

  if (isHtmxRequest(c)) {
    return htmxResponse(c, user.id, {
      text: "状態を更新しました",
      type: "info",
    });
  }
  return c.json({
    success: true,
    currentState: userState?.currentState || "not_checked_in",
    record,
  });
});

// 時刻修正申請一覧（自分の申請のみ）
attendanceRoutes.get("/edit-requests", async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const { record } = getUserStateAndRecord(user.id);

  if (!record) {
    return c.json({ success: true, requests: [] });
  }

  const stmt = db.prepare(
    "SELECT * FROM TimeEditRequest WHERE userId = ? AND recordId = ? ORDER BY createdAt DESC",
  );
  const requests = stmt.all(user.id, record.id);

  return c.json({ success: true, requests });
});

// 時刻修正申請
attendanceRoutes.post("/edit-request", async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  try {
    const body = await c.req.parseBody();
    const recordId = body.recordId as string;
    const field = body.field as string;
    const newValueRaw = body.newValue as string;
    const reason = body.reason as string;

    // バリデーション
    if (!recordId || !field || !newValueRaw || !reason) {
      if (isHtmxRequest(c)) {
        return htmxResponse(c, user.id, {
          text: "必要なパラメータが不足しています",
          type: "error",
        });
      }
      return c.json(
        { success: false, message: "必要なパラメータが不足しています" },
        400,
      );
    }

    const validFields = ["checkIn", "checkOut", "breakStart", "breakEnd"];
    if (!validFields.includes(field)) {
      if (isHtmxRequest(c)) {
        return htmxResponse(c, user.id, {
          text: "無効なフィールド名です",
          type: "error",
        });
      }
      return c.json({ success: false, message: "無効なフィールド名です" }, 400);
    }

    // レコード確認
    const recordStmt = db.prepare(
      "SELECT * FROM AttendanceRecord WHERE id = ?",
    );
    const record = recordStmt.get(recordId) as AttendanceRecord | undefined;

    if (!record) {
      if (isHtmxRequest(c)) {
        return htmxResponse(c, user.id, {
          text: "指定された勤怠記録が見つかりません",
          type: "error",
        });
      }
      return c.json(
        { success: false, message: "指定された勤怠記録が見つかりません" },
        404,
      );
    }

    if (record.userId !== user.id) {
      if (isHtmxRequest(c)) {
        return htmxResponse(c, user.id, {
          text: "他のユーザーの勤怠記録は修正できません",
          type: "error",
        });
      }
      return c.json(
        { success: false, message: "他のユーザーの勤怠記録は修正できません" },
        403,
      );
    }

    // 現在の値を取得
    const oldValue = (record as any)[field] || null;

    // newValueを正しい日付時刻形式に変換
    // input type="time" からは "HH:mm" 形式で送られてくるので、recordのdateと組み合わせる
    let newValue: string;
    if (newValueRaw.match(/^\d{2}:\d{2}$/)) {
      // HH:mm形式の場合、recordの日付と組み合わせてISO形式に変換
      const recordDate = new Date(record.date);
      const [hours, minutes] = newValueRaw.split(":").map(Number);
      recordDate.setHours(hours, minutes, 0, 0);
      newValue = recordDate.toISOString();
    } else {
      // すでにISO形式などの場合はそのまま使用
      newValue = newValueRaw;
    }

    // 申請を作成
    const insertStmt = db.prepare(`
      INSERT INTO TimeEditRequest (id, userId, recordId, field, oldValue, newValue, reason, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);
    const now = nowISO();
    insertStmt.run(
      generateId(),
      user.id,
      recordId,
      field,
      oldValue,
      newValue,
      reason,
      now,
      now,
    );

    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "修正申請を受け付けました。管理者の承認をお待ちください。",
        type: "success",
      });
    }
    return c.json({ success: true, message: "修正申請を受け付けました" });
  } catch (error) {
    console.error("Edit request error:", error);
    if (isHtmxRequest(c)) {
      return htmxResponse(c, user.id, {
        text: "申請中にエラーが発生しました",
        type: "error",
      });
    }
    return c.json(
      { success: false, message: "申請中にエラーが発生しました" },
      500,
    );
  }
});
