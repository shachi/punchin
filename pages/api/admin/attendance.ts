// pages/api/admin/attendance.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: "認証が必要です" });
    }

    // 管理者権限のチェック
    if (!session.user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "管理者権限が必要です" });
    }

    console.log("Admin API request:", req.query);

    // クエリパラメータから日付範囲を取得
    const startDateStr = req.query.startDate || req.query.start_date;
    const endDateStr = req.query.endDate || req.query.end_date;

    // ページングパラメータの取得
    const page = parseInt((req.query.page as string) || "1", 10);
    const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
    const skip = (page - 1) * pageSize;

    // 日付のバリデーション
    let start, end;

    try {
      // 日付文字列のバリデーション
      if (
        typeof startDateStr === "string" &&
        startDateStr.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        start = new Date(startDateStr);
      } else {
        // 無効な日付の場合は現在の月の初日を使用
        start = new Date();
        start.setDate(1);
      }

      if (
        typeof endDateStr === "string" &&
        endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        end = new Date(endDateStr);
      } else {
        // 無効な日付の場合は現在の日付を使用
        end = new Date();
      }

      // 時刻を設定
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}`);
    } catch (err) {
      console.error("Date parsing error:", err, { startDateStr, endDateStr });

      // エラーが発生した場合はデフォルト値を使用
      start = new Date();
      start.setDate(1); // 月初
      start.setHours(0, 0, 0, 0);

      end = new Date();
      end.setHours(23, 59, 59, 999);

      console.log(
        `Using default date range: ${start.toISOString()} to ${end.toISOString()}`,
      );
    }
    console.log(`Pagination: page=${page}, pageSize=${pageSize}, skip=${skip}`);

    // 日付が無効な場合のデフォルト値設定
    if (isNaN(start.getTime())) {
      start.setDate(1); // 月初
    }

    // 総件数を取得
    const total = await prisma.attendanceRecord.count({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // ページ数を計算
    const totalPages = Math.ceil(total / pageSize);

    // 勤怠記録の取得（ページング適用）
    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { userId: "asc" }],
      skip: skip,
      take: pageSize,
    });

    console.log(`Found ${records.length} records (total: ${total})`);

    // レスポンス用にデータを加工
    const formattedRecords = records.map((record) => {
      // 休憩時間の計算 (分)
      let breakDuration = null;
      if (record.breakStart && record.breakEnd) {
        breakDuration =
          (new Date(record.breakEnd).getTime() -
            new Date(record.breakStart).getTime()) /
          (1000 * 60);
      }

      // 総勤務時間の計算 (時間)
      let totalWorkHours = null;
      if (record.checkIn && record.checkOut) {
        const totalMinutes =
          (new Date(record.checkOut).getTime() -
            new Date(record.checkIn).getTime()) /
          (1000 * 60);
        totalWorkHours = (totalMinutes - (breakDuration || 0)) / 60;
      }

      return {
        id: record.id,
        userId: record.userId,
        userName: record.user.name,
        date: record.date.toISOString(),
        checkIn: record.checkIn?.toISOString() || null,
        breakStart: record.breakStart?.toISOString() || null,
        breakEnd: record.breakEnd?.toISOString() || null,
        checkOut: record.checkOut?.toISOString() || null,
        isAbsent: record.isAbsent,
        breakDuration,
        totalWorkHours,
      };
    });

    return res.status(200).json({
      success: true,
      records: formattedRecords,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
