// pages/api/admin/export-csv.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import dayjs from "../../../lib/dayjs";

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
    let start, end;

    try {
      // startDateとendDateのバリデーション
      start = startDate
        ? dayjs(startDate as string)
            .startOf("day")
            .toDate()
        : dayjs().startOf("month").toDate();
      end = endDate
        ? dayjs(endDate as string)
            .endOf("day")
            .toDate()
        : dayjs().endOf("day").toDate();

      // 無効な日付の場合
      if (!dayjs(start).isValid()) {
        start = dayjs().startOf("month").toDate();
      }

      if (!dayjs(end).isValid()) {
        end = dayjs().endOf("day").toDate();
      }

      console.log(
        `Date range: ${dayjs(start).format("YYYY-MM-DD")} to ${dayjs(end).format("YYYY-MM-DD")}`,
      );
    } catch (error) {
      console.error("Date parsing error:", error);
      start = dayjs().startOf("month").toDate();
      end = dayjs().endOf("day").toDate();
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
    // 月次CSVファイル名の作成
    const fileName =
      req.query.type === "monthly"
        ? `monthly_attendance_${dayjs(start).format("yyyyMM")}.csv`
        : `attendance_${dayjs(start).format("yyyyMMdd")}-${dayjs(end).format("yyyyMMdd")}.csv`;

    // CSVヘッダーに月次情報を追加
    const header =
      req.query.type === "monthly"
        ? `${dayjs(start).format("yyyy年M月")}の勤怠記録\n日付,氏名,出社時間,退社時間,休憩時間(分),勤務時間,欠勤\n`
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

      // 日付フォーマット - nullチェックを追加
      const date = record.date ? dayjs(record.date).format("YYYY/MM/DD") : "-";

      // 時刻フォーマット - nullチェックを強化
      const formatTime = (time: Date | null) => {
        if (!time) return "-";
        try {
          return dayjs(time).format("HH:mm:ss");
        } catch (error) {
          console.error("Time format error:", error, time);
          return "-";
        }
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
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
