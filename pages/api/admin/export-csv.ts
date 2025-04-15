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
    const { startDate, endDate, type } = req.query;
    console.log("Export parameters:", { startDate, endDate, type });

    // 日付のバリデーションと設定
    let start, end;

    try {
      // startDateとendDateをJST基準で処理
      if (startDate && typeof startDate === "string") {
        start = dayjs.tz(startDate, "Asia/Tokyo").startOf("day");
      } else {
        start = dayjs().tz("Asia/Tokyo").startOf("month");
      }

      if (endDate && typeof endDate === "string") {
        end = dayjs.tz(endDate, "Asia/Tokyo").endOf("day");
      } else {
        end = dayjs().tz("Asia/Tokyo").endOf("day");
      }

      // 無効な日付の場合のフォールバック
      if (!start.isValid()) {
        console.warn("Invalid start date, using fallback");
        start = dayjs().tz("Asia/Tokyo").startOf("month");
      }

      if (!end.isValid()) {
        console.warn("Invalid end date, using fallback");
        end = dayjs().tz("Asia/Tokyo").endOf("day");
      }

      console.log(
        `Date range: ${start.format("YYYY-MM-DD")} to ${end.format("YYYY-MM-DD")}`,
      );
    } catch (error) {
      console.error("Date parsing error:", error);
      start = dayjs().tz("Asia/Tokyo").startOf("month");
      end = dayjs().tz("Asia/Tokyo").endOf("day");
    }

    // 勤怠記録の取得
    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: {
          gte: start.toDate(),
          lte: end.toDate(),
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

    console.log(`Retrieved ${records.length} records`);

    // CSVファイル名の作成（ASCII文字のみ使用）
    const safeFileName =
      type === "monthly"
        ? `monthly_attendance_${start.format("YYYYMM")}.csv`
        : `attendance_${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.csv`;

    // CSVヘッダーに月次情報を追加
    const headerRow =
      type === "monthly"
        ? `${start.format("YYYY年M月")}の勤怠記録\n日付,氏名,出社時間,退社時間,休憩時間(分),勤務時間,欠勤\n`
        : "日付,氏名,出社時間,退社時間,休憩時間(分),勤務時間,欠勤\n";

    let csv = headerRow;

    // 各レコードをCSV行に変換
    records.forEach((record) => {
      try {
        // 休憩時間の計算 (分)
        let breakDuration = "-";
        if (record.breakStart && record.breakEnd) {
          try {
            const breakStartTime = dayjs(record.breakStart).tz("Asia/Tokyo");
            const breakEndTime = dayjs(record.breakEnd).tz("Asia/Tokyo");

            if (breakStartTime.isValid() && breakEndTime.isValid()) {
              const durationMinutes = breakEndTime.diff(
                breakStartTime,
                "minute",
              );
              breakDuration = Math.max(0, durationMinutes).toString();
            }
          } catch (err) {
            console.error("Error calculating break duration:", err);
          }
        }

        // 総勤務時間の計算 (時間)
        let totalWorkHours = "-";
        if (record.checkIn && record.checkOut) {
          try {
            const checkInTime = dayjs(record.checkIn).tz("Asia/Tokyo");
            const checkOutTime = dayjs(record.checkOut).tz("Asia/Tokyo");

            if (checkInTime.isValid() && checkOutTime.isValid()) {
              const totalMinutes = checkOutTime.diff(checkInTime, "minute");

              // 休憩時間の計算
              const breakMinutes =
                record.breakStart && record.breakEnd
                  ? dayjs(record.breakEnd)
                      .tz("Asia/Tokyo")
                      .diff(dayjs(record.breakStart).tz("Asia/Tokyo"), "minute")
                  : 0;

              // 勤務時間 = 総時間 - 休憩時間
              const workMinutes = Math.max(
                0,
                totalMinutes - Math.max(0, breakMinutes),
              );
              const hours = workMinutes / 60;
              totalWorkHours = hours.toFixed(2);
            }
          } catch (err) {
            console.error("Error calculating total work hours:", err);
          }
        }

        // 日付フォーマット
        const date = record.date
          ? dayjs(record.date).tz("Asia/Tokyo").format("YYYY/MM/DD")
          : "-";

        // 時刻フォーマット
        const formatTime = (time: Date | null) => {
          if (!time) return "-";
          try {
            const dayjsTime = dayjs(time).tz("Asia/Tokyo");
            return dayjsTime.isValid() ? dayjsTime.format("HH:mm:ss") : "-";
          } catch (error) {
            console.error("Time format error:", error);
            return "-";
          }
        };

        // CSVの行を作成
        const row = [
          date,
          record.user?.name || "不明",
          formatTime(record.checkIn),
          formatTime(record.checkOut),
          breakDuration,
          totalWorkHours,
          record.isAbsent ? "はい" : "いいえ",
        ].join(",");

        csv += row + "\n";
      } catch (rowError) {
        console.error("Error processing record:", rowError, record);
        // エラー発生時も最低限の情報を出力
        const fallbackRow = [
          record.date ? dayjs(record.date).format("YYYY/MM/DD") : "-",
          record.user?.name || "不明",
          "-",
          "-",
          "-",
          "-",
          record.isAbsent ? "はい" : "いいえ",
        ].join(",");
        csv += fallbackRow + "\n";
      }
    });

    // Content-Dispositionヘッダーの設定 (RFC 5987に準拠)
    // ファイル名をエンコードして無効な文字を回避
    const encodedFilename = encodeURIComponent(safeFileName).replace(
      /['()]/g,
      escape,
    );

    // CSVファイルをレスポンスとして返す
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFilename}`,
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
