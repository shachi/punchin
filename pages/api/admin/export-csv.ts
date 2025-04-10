// pages/api/admin/export-csv.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

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

    // クエリパラメータから日付範囲を取得
    const { startDate, endDate } = req.query;

    // 日付のバリデーション
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date();

    // 日付が無効な場合のデフォルト値設定
    if (isNaN(start.getTime())) {
      start.setDate(1); // 月初
    }

    if (isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999); // 今日の終わり
    } else {
      end.setHours(23, 59, 59, 999); // 指定日の終わり
    }

    // 勤怠記録の取得
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
      orderBy: [{ date: "desc" }, { user: { name: "asc" } }],
    });

    // 月次CSVファイル名の作成
    const fileName =
      req.query.type === "monthly"
        ? `monthly_attendance_${format(start, "yyyyMM")}.csv`
        : `attendance_${format(start, "yyyyMMdd")}-${format(end, "yyyyMMdd")}.csv`;

    // CSVヘッダーに月次情報を追加
    const header =
      req.query.type === "monthly"
        ? `${format(start, "yyyy年M月")}の勤怠記録\n日付,氏名,出社時間,退社時間,休憩時間(分),勤務時間,欠勤\n`
        : "日付,氏名,出社時間,退社時間,休憩時間(分),勤務時間,欠勤\n";

    let csv = header;

    // タイムゾーン指定
    const timeZone = "Asia/Tokyo";

    records.forEach((record) => {
      // 休憩時間の計算 (分)
      let breakDuration = "-";
      if (record.breakStart && record.breakEnd) {
        const breakStartTime = new Date(record.breakStart);
        const breakEndTime = new Date(record.breakEnd);
        const durationMinutes =
          (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60);
        breakDuration = Math.round(durationMinutes).toString();
      }

      // 総勤務時間の計算 (時間)
      let totalWorkHours = "-";
      if (record.checkIn && record.checkOut) {
        const checkInTime = new Date(record.checkIn);
        const checkOutTime = new Date(record.checkOut);
        const totalMinutes =
          (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60);
        const breakMinutes =
          record.breakStart && record.breakEnd
            ? (new Date(record.breakEnd).getTime() -
                new Date(record.breakStart).getTime()) /
              (1000 * 60)
            : 0;
        const hours = (totalMinutes - breakMinutes) / 60;
        totalWorkHours = hours.toFixed(2);
      }

      // 日付を日本時間でフォーマット
      const recordDate = new Date(record.date);
      const jstDate = toZonedTime(recordDate, timeZone);
      const date = format(jstDate, "yyyy/MM/dd");

      // 時刻を日本時間でフォーマット
      const formatTimeToJST = (time: Date | null) => {
        if (!time) return "-";
        const jstTime = toZonedTime(time, timeZone);
        return format(jstTime, "HH:mm:ss");
      };

      // CSVの行を作成
      const row = [
        date,
        record.user.name,
        formatTimeToJST(record.checkIn),
        formatTimeToJST(record.checkOut),
        breakDuration,
        totalWorkHours,
        record.isAbsent ? "はい" : "いいえ",
      ].join(",");

      csv += row + "\n";
    });

    // CSVファイルをレスポンスとして返す
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
