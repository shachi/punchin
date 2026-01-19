// attendance-deno/src/routes/admin.tsx
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { getDb, generateId, nowISO } from "../db/client.ts";
import { requireAdmin } from "../middleware/auth.ts";
import type {
  AppEnv,
  AttendanceRecord,
  TimeEditRequest,
  User,
} from "../types.ts";
import { AdminRecordsTable } from "../views/pages/AdminPage.tsx";

export const adminRoutes = new Hono<AppEnv>();

// 全ルートで管理者権限必須
adminRoutes.use("*", requireAdmin);

// 勤怠記録一覧取得
adminRoutes.get("/attendance", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);

  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "10", 10);

  // HTMXリクエストかどうか判定
  const isHtmxRequest = c.req.header("HX-Request") === "true";

  try {
    // 日付の設定
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = now;

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;
    end.setHours(23, 59, 59, 999);

    // 総件数取得
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total FROM AttendanceRecord
      WHERE date >= ? AND date <= ?
    `);
    const countResult = countStmt.get(
      start.toISOString(),
      end.toISOString(),
    ) as { total: number };
    const total = countResult.total;
    const totalPages = Math.ceil(total / pageSize);

    // レコード取得
    const offset = (page - 1) * pageSize;
    const stmt = db.prepare(`
      SELECT
        ar.*,
        u.name as userName,
        u.email as userEmail
      FROM AttendanceRecord ar
      JOIN User u ON ar.userId = u.id
      WHERE ar.date >= ? AND ar.date <= ?
      ORDER BY ar.date DESC, u.name ASC
      LIMIT ? OFFSET ?
    `);
    const records = stmt.all(
      start.toISOString(),
      end.toISOString(),
      pageSize,
      offset,
    ) as any[];

    // データ整形
    const formattedRecords = records.map((record) => {
      let breakDuration: number | null = null;
      if (record.breakStart && record.breakEnd) {
        const breakStartTime = new Date(record.breakStart).getTime();
        const breakEndTime = new Date(record.breakEnd).getTime();
        breakDuration = Math.round((breakEndTime - breakStartTime) / 60000);
      }

      let totalWorkHours: number | null = null;
      if (record.checkIn && record.checkOut) {
        const checkInTime = new Date(record.checkIn).getTime();
        const checkOutTime = new Date(record.checkOut).getTime();
        const totalMinutes = (checkOutTime - checkInTime) / 60000;
        const workMinutes = breakDuration
          ? totalMinutes - breakDuration
          : totalMinutes;
        totalWorkHours = workMinutes / 60;
      }

      return {
        id: record.id,
        userId: record.userId,
        userName: record.userName,
        date: record.date,
        checkIn: record.checkIn,
        breakStart: record.breakStart,
        breakEnd: record.breakEnd,
        checkOut: record.checkOut,
        isAbsent: record.isAbsent === 1,
        breakDuration,
        totalWorkHours,
      };
    });

    const pagination = {
      currentPage: page,
      totalPages,
      total,
      pageSize,
    };

    // HTMXリクエストの場合はHTMLを返す
    if (isHtmxRequest) {
      const startDateStr = start.toISOString().slice(0, 10);
      const endDateStr = end.toISOString().slice(0, 10);
      return c.html(
        <AdminRecordsTable
          records={formattedRecords}
          pagination={pagination}
          startDate={startDateStr}
          endDate={endDateStr}
        />,
      );
    }

    // 通常のAPIリクエストの場合はJSONを返す
    return c.json({
      success: true,
      records: formattedRecords,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);

    if (isHtmxRequest) {
      return c.html(
        <div class="text-center py-8 text-red-500">
          勤怠記録の取得に失敗しました
        </div>,
      );
    }
    return c.json(
      { success: false, message: "勤怠記録の取得に失敗しました" },
      500,
    );
  }
});

// CSVエクスポート
adminRoutes.get("/export-csv", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);

  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  const type = url.searchParams.get("type") || "";

  try {
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;
    end.setHours(23, 59, 59, 999);

    // 氏名でグループ化、日付昇順でソート
    const stmt = db.prepare(`
      SELECT
        ar.*,
        u.name as userName
      FROM AttendanceRecord ar
      JOIN User u ON ar.userId = u.id
      WHERE ar.date >= ? AND ar.date <= ?
      ORDER BY u.name ASC, ar.date ASC
    `);
    const records = stmt.all(start.toISOString(), end.toISOString()) as any[];

    // CSV生成（氏名ごとにまとめる）
    let csv = "氏名,日付,出社時間,退社時間,休憩時間(分),勤務時間\n";

    // 氏名ごとにグループ化
    const groupedByUser: Map<string, any[]> = new Map();
    for (const record of records) {
      const userName = record.userName || "不明";
      if (!groupedByUser.has(userName)) {
        groupedByUser.set(userName, []);
      }
      groupedByUser.get(userName)!.push(record);
    }

    const formatDate = (d: string) =>
      d ? new Date(d).toLocaleDateString("ja-JP") : "-";
    const formatTime = (d: string) =>
      d ? new Date(d).toLocaleTimeString("ja-JP") : "-";

    // 各ユーザーごとに出力
    for (const [userName, userRecords] of groupedByUser) {
      let totalBreakMinutes = 0;
      let totalWorkHours = 0;

      for (const record of userRecords) {
        // 休憩時間計算
        let breakDuration = 0;
        if (record.breakStart && record.breakEnd) {
          const startTime = new Date(record.breakStart).getTime();
          const endTime = new Date(record.breakEnd).getTime();
          breakDuration = Math.round((endTime - startTime) / 60000);
        }
        totalBreakMinutes += breakDuration;

        // 勤務時間計算
        let workHours = 0;
        if (record.checkIn && record.checkOut) {
          const checkInTime = new Date(record.checkIn).getTime();
          const checkOutTime = new Date(record.checkOut).getTime();
          const totalMinutes = (checkOutTime - checkInTime) / 60000;
          workHours = (totalMinutes - breakDuration) / 60;
        }
        totalWorkHours += workHours;

        // 日別明細行
        const row = [
          userName,
          formatDate(record.date),
          formatTime(record.checkIn),
          formatTime(record.checkOut),
          breakDuration > 0 ? breakDuration.toString() : "0",
          workHours > 0 ? workHours.toFixed(2) : "0.00",
        ].join(",");

        csv += row + "\n";
      }

      // 月間合計行
      const summaryRow = [
        userName,
        "【月間合計】",
        "-",
        "-",
        totalBreakMinutes.toString(),
        totalWorkHours.toFixed(2),
      ].join(",");

      csv += summaryRow + "\n";
      csv += "\n"; // ユーザー間の空行
    }

    const filename =
      type === "monthly"
        ? `monthly_attendance_${start.toISOString().slice(0, 7)}.csv`
        : `attendance_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv`;

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return c.json(
      { success: false, message: "CSVエクスポートに失敗しました" },
      500,
    );
  }
});

// 時刻修正申請一覧（管理者用）
adminRoutes.get("/edit-requests", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status") || "pending";

  try {
    let query = `
      SELECT
        ter.*,
        u.name as userName,
        u.email as userEmail
      FROM TimeEditRequest ter
      JOIN User u ON ter.userId = u.id
    `;

    const params: string[] = [];
    if (status !== "all") {
      query += " WHERE ter.status = ?";
      params.push(status);
    }

    query += " ORDER BY ter.status ASC, ter.createdAt DESC";

    const stmt = db.prepare(query);
    const requests = params.length > 0 ? stmt.all(...params) : stmt.all();

    // userオブジェクトを追加
    const formattedRequests = (requests as any[]).map((req) => ({
      ...req,
      user: {
        id: req.userId,
        name: req.userName,
        email: req.userEmail,
      },
    }));

    return c.json({ success: true, requests: formattedRequests });
  } catch (error) {
    console.error("Error fetching edit requests:", error);
    return c.json(
      { success: false, message: "修正申請の取得に失敗しました" },
      500,
    );
  }
});

// 時刻修正申請の承認
adminRoutes.post("/edit-requests/:id/approve", async (c) => {
  const db = getDb();
  const requestId = c.req.param("id");

  try {
    // 申請を取得
    const requestStmt = db.prepare(
      "SELECT * FROM TimeEditRequest WHERE id = ?",
    );
    const request = requestStmt.get(requestId) as TimeEditRequest | undefined;

    if (!request) {
      return c.redirect("/admin/edit-requests?error=not_found");
    }

    if (request.status !== "pending") {
      return c.redirect("/admin/edit-requests?error=already_processed");
    }

    const now = nowISO();

    // 申請ステータス更新
    const updateRequestStmt = db.prepare(
      "UPDATE TimeEditRequest SET status = ?, updatedAt = ? WHERE id = ?",
    );
    updateRequestStmt.run("approved", now, requestId);

    // 勤怠データを更新
    const validFields = ["checkIn", "checkOut", "breakStart", "breakEnd"];
    if (validFields.includes(request.field)) {
      const updateRecordStmt = db.prepare(
        `UPDATE AttendanceRecord SET ${request.field} = ? WHERE id = ?`,
      );
      updateRecordStmt.run(request.newValue, request.recordId);
    }

    return c.redirect("/admin/edit-requests?success=approved");
  } catch (error) {
    console.error("Error approving edit request:", error);
    return c.redirect("/admin/edit-requests?error=server_error");
  }
});

// 時刻修正申請の拒否
adminRoutes.post("/edit-requests/:id/reject", async (c) => {
  const db = getDb();
  const requestId = c.req.param("id");

  try {
    // 申請を取得
    const requestStmt = db.prepare(
      "SELECT * FROM TimeEditRequest WHERE id = ?",
    );
    const request = requestStmt.get(requestId) as TimeEditRequest | undefined;

    if (!request) {
      return c.redirect("/admin/edit-requests?error=not_found");
    }

    if (request.status !== "pending") {
      return c.redirect("/admin/edit-requests?error=already_processed");
    }

    const now = nowISO();

    // 申請ステータス更新
    const updateRequestStmt = db.prepare(
      "UPDATE TimeEditRequest SET status = ?, updatedAt = ? WHERE id = ?",
    );
    updateRequestStmt.run("rejected", now, requestId);

    return c.redirect("/admin/edit-requests?success=rejected");
  } catch (error) {
    console.error("Error rejecting edit request:", error);
    return c.redirect("/admin/edit-requests?error=server_error");
  }
});

// 時刻修正申請の処理（承認/拒否）- レガシーAPI
adminRoutes.post("/process-edit-request", async (c) => {
  const db = getDb();

  try {
    const body = await c.req.parseBody();
    const requestId = body.requestId as string;
    const action = body.action as string;

    if (!requestId || !action) {
      return c.json(
        { success: false, message: "必要なパラメータが不足しています" },
        400,
      );
    }

    if (action !== "approve" && action !== "reject") {
      return c.json({ success: false, message: "無効なアクションです" }, 400);
    }

    // 申請を取得
    const requestStmt = db.prepare(
      "SELECT * FROM TimeEditRequest WHERE id = ?",
    );
    const request = requestStmt.get(requestId) as TimeEditRequest | undefined;

    if (!request) {
      return c.json({ success: false, message: "申請が見つかりません" }, 404);
    }

    if (request.status !== "pending") {
      return c.json(
        { success: false, message: "この申請は既に処理されています" },
        400,
      );
    }

    const now = nowISO();
    const newStatus = action === "approve" ? "approved" : "rejected";

    // 申請ステータス更新
    const updateRequestStmt = db.prepare(
      "UPDATE TimeEditRequest SET status = ?, updatedAt = ? WHERE id = ?",
    );
    updateRequestStmt.run(newStatus, now, requestId);

    // 承認の場合は勤怠データを更新
    if (action === "approve") {
      const validFields = ["checkIn", "checkOut", "breakStart", "breakEnd"];
      if (validFields.includes(request.field)) {
        const updateRecordStmt = db.prepare(
          `UPDATE AttendanceRecord SET ${request.field} = ? WHERE id = ?`,
        );
        updateRecordStmt.run(request.newValue, request.recordId);
      }
    }

    return c.json({
      success: true,
      message:
        action === "approve" ? "申請を承認しました" : "申請を拒否しました",
    });
  } catch (error) {
    console.error("Error processing edit request:", error);
    return c.json(
      { success: false, message: "申請処理中にエラーが発生しました" },
      500,
    );
  }
});
