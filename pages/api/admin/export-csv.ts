// pages/api/admin/export-csv.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import { format } from "date-fns";

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

    // CSVデータの作成
    let csv = "日付,氏名,出社時間,退社時間,休憩時間(分),勤務時間,欠勤\n";

    records.forEach((record) => {
      // 休憩時間の計算 (分)
      let breakDuration = "-";
      if (record.breakStart && record.breakEnd) {
        const durationMinutes =
          (new Date(record.breakEnd).getTime() -
            new Date(record.breakStart).getTime()) /
          (1000 * 60);
        breakDuration = Math.round(durationMinutes).toString();
      }

      // 総勤務時間の計算 (時間)
      let totalWorkHours = "-";
      if (record.checkIn && record.checkOut) {
        const totalMinutes =
          (new Date(record.checkOut).getTime() -
            new Date(record.checkIn).getTime()) /
          (1000 * 60);
        const breakMinutes =
          record.breakStart && record.breakEnd
            ? (new Date(record.breakEnd).getTime() -
                new Date(record.breakStart).getTime()) /
              (1000 * 60)
            : 0;
        const hours = (totalMinutes - breakMinutes) / 60;
        totalWorkHours = hours.toFixed(2);
      }

      // 日付フォーマット
      const date = format(record.date, "yyyy/MM/dd");

      // 時刻フォーマット
      const formatTime = (time: Date | null) => {
        return time ? format(time, "HH:mm:ss") : "-";
      };

      // CSVの行を作成
      const row = [
        date,
        record.user.name,
        formatTime(record.checkIn),
        formatTime(record.checkOut),
        breakDuration,
        totalWorkHours,
        record.isAbsent ? "はい" : "いいえ",
      ].join(",");

      csv += row + "\n";
    });

    // CSVファイルをレスポンスとして返す
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${format(start, "yyyyMMdd")}-${format(end, "yyyyMMdd")}.csv`,
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
