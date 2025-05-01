// pages/api/admin/attendance.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import dayjs from "../../../lib/dayjs";

// 型定義
interface QueryParams {
  startDate?: string;
  endDate?: string;
  page?: string;
  pageSize?: string;
}

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
    // セッション・権限チェック
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: "認証が必要です" });
    }

    if (!session.user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "管理者権限が必要です" });
    }

    // クエリパラメータを取得
    const {
      startDate,
      endDate,
      page = "1",
      pageSize = "10",
    } = req.query as QueryParams;

    // 日付のバリデーション
    let start, end;

    try {
      // 日付が指定されていない場合はデフォルト値を使用
      if (!startDate) {
        start = dayjs().tz("Asia/Tokyo").startOf("month");
      } else {
        // 日付文字列をJST基準でパース
        start = dayjs.tz(startDate, "Asia/Tokyo").startOf("day");
      }

      if (!endDate) {
        end = dayjs().tz("Asia/Tokyo").endOf("day");
      } else {
        // 日付文字列をJST基準でパース
        end = dayjs.tz(endDate, "Asia/Tokyo").endOf("day");
      }

      // 日付が無効な場合はエラー
      if (!start.isValid() || !end.isValid()) {
        return res.status(400).json({
          success: false,
          message: "無効な日付形式です",
        });
      }

      console.log("日付範囲 (JST):", {
        startJST: start.format("YYYY-MM-DD HH:mm:ss"),
        endJST: end.format("YYYY-MM-DD HH:mm:ss"),
      });

      // 対応する協定世界時 (UTC) を計算
      const startUTC = start.toDate();
      const endUTC = end.toDate();

      console.log("日付範囲 (UTC):", {
        startUTC: dayjs(startUTC).format("YYYY-MM-DD HH:mm:ss"),
        endUTC: dayjs(endUTC).format("YYYY-MM-DD HH:mm:ss"),
      });

      // 現在のページと1ページあたりのサイズを数値に変換
      const currentPage = Number.parseInt(page, 10);
      const itemsPerPage = Number.parseInt(pageSize, 10);

      // ページングのバリデーション
      if (
        Number.isNaN(currentPage) ||
        Number.isNaN(itemsPerPage) ||
        currentPage < 1 ||
        itemsPerPage < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "無効なページング値です",
        });
      }

      // スキップするレコード数を計算
      const skip = (currentPage - 1) * itemsPerPage;

      // 合計レコード数を取得
      const total = await prisma.attendanceRecord.count({
        where: {
          date: {
            gte: startUTC,
            lte: endUTC,
          },
        },
      });

      // 総ページ数を計算
      const totalPages = Math.ceil(total / itemsPerPage);

      // データ取得範囲が有効かチェック
      if (skip >= total && total > 0) {
        return res.status(400).json({
          success: false,
          message: "指定されたページは存在しません",
        });
      }

      // 勤怠記録を取得
      const records = await prisma.attendanceRecord.findMany({
        where: {
          date: {
            gte: startUTC,
            lte: endUTC,
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
        orderBy: [
          {
            date: "desc",
          },
          {
            user: {
              name: "asc",
            },
          },
        ],
        skip,
        take: itemsPerPage,
      });

      console.log(`取得レコード数: ${records.length}`);

      // レスポンス用にデータを整形
      const formattedRecords = records.map((record) => {
        // 休憩時間の計算 (分)
        let breakDuration = null;
        if (record.breakStart && record.breakEnd) {
          const breakStartTime = dayjs(record.breakStart);
          const breakEndTime = dayjs(record.breakEnd);
          breakDuration = breakEndTime.diff(breakStartTime, "minute");
        }

        // 総勤務時間の計算 (時間)
        let totalWorkHours = null;
        if (record.checkIn && record.checkOut) {
          const checkInTime = dayjs(record.checkIn);
          const checkOutTime = dayjs(record.checkOut);
          const totalMinutes = checkOutTime.diff(checkInTime, "minute");
          const workMinutes = breakDuration
            ? totalMinutes - breakDuration
            : totalMinutes;
          totalWorkHours = workMinutes / 60;
        }

        return {
          id: record.id,
          userId: record.userId,
          userName: record.user.name,
          date: record.date,
          checkIn: record.checkIn,
          breakStart: record.breakStart,
          breakEnd: record.breakEnd,
          checkOut: record.checkOut,
          isAbsent: record.isAbsent,
          breakDuration,
          totalWorkHours,
        };
      });

      return res.status(200).json({
        success: true,
        records: formattedRecords,
        pagination: {
          currentPage,
          totalPages,
          total,
          pageSize: itemsPerPage,
        },
      });
    } catch (error) {
      console.error("Date parsing error:", error);
      return res.status(400).json({
        success: false,
        message: "日付のパースに失敗しました",
      });
    }
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
