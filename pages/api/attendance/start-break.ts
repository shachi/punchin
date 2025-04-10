// pages/api/attendance/start-break.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { prisma } from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
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

    const userId = session.user.id;
    console.log("休憩開始処理開始 - ユーザーID:", userId);

    // ユーザー状態を確認
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("現在のユーザー状態:", userState);

    if (userState?.currentState !== "checked_in") {
      return res.status(400).json({
        success: false,
        message: "出社状態でないと休憩を開始できません",
      });
    }

    // 現在の日時と業務日を取得（日本時間ベース）
    const now = new Date();
    const jstNow = toZonedTime(now, "Asia/Tokyo");

    // 日本時間で業務日を判定
    const jstBusinessDate = new Date(jstNow);

    if (jstNow.getHours() < 4) {
      jstBusinessDate.setDate(jstBusinessDate.getDate() - 1);
    }
    jstBusinessDate.setHours(0, 0, 0, 0);

    // JSTの業務日をUTCに変換（データベース比較用）
    const today = fromZonedTime(jstBusinessDate, "Asia/Tokyo");

    console.log("現在の日時:", now);
    console.log("今日の日付:", today);

    let record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!record) {
      console.log("出社記録が見つからないため、新規作成します");
      record = await prisma.attendanceRecord.create({
        data: {
          userId,
          date: now,
          checkIn: now,
        },
      });
    }

    // 明示的なチェックを追加
    if (!record.checkIn) {
      console.log("出社時間が記録されていません");

      // 出社時間がない場合は記録
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkIn: now, // 現在時刻を出社時間として設定
        },
      });

      console.log("出社時間を追加しました:", record);
    }

    // 休憩開始時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        breakStart: now,
      },
    });

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "on_break",
        lastUpdated: now,
      },
    });

    console.log("休憩開始処理完了");

    return res.status(200).json({
      success: true,
      message: "休憩を開始しました",
      currentState: "on_break",
    });
  } catch (error) {
    console.error("Error starting break:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
