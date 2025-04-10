// pages/api/attendance/recheck-in.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import { toZonedTime, fromZonedTime } from "date-fns-tz"; // この依存関係が必要

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
    console.log("再出社処理開始 - ユーザーID:", userId);

    // ユーザー状態を確認
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("現在のユーザー状態:", userState);

    if (userState?.currentState !== "checked_out") {
      return res
        .status(400)
        .json({ success: false, message: "退社状態でないと再出社できません" });
    }

    // 現在の日時（UTC）
    const now = new Date();

    // 現在の日時を日本時間に変換
    const jstNow = toZonedTime(now, "Asia/Tokyo");
    console.log("現在時刻(JST):", jstNow);

    // 日本時間での今日の日付を取得
    const jstToday = new Date(jstNow);
    jstToday.setHours(0, 0, 0, 0);

    // 業務日の境界（AM4:00）を考慮
    const jstBusinessDate = new Date(jstNow);
    if (jstNow.getHours() < 4) {
      jstBusinessDate.setDate(jstBusinessDate.getDate() - 1);
    }
    jstBusinessDate.setHours(0, 0, 0, 0);

    // JSTの業務日をUTCに変換（データベース比較用）
    const businessDate = fromZonedTime(jstBusinessDate, "Asia/Tokyo");

    console.log("業務日(JST):", jstBusinessDate);
    console.log("業務日(UTC):", businessDate);

    // 業務日の範囲で記録を検索
    const businessDayStart = new Date(businessDate);
    const businessDayEnd = new Date(businessDate);
    businessDayEnd.setDate(businessDayEnd.getDate() + 1);
    businessDayEnd.setHours(3, 59, 59, 999);
    businessDayEnd.setSeconds(59, 999);

    // 既存の記録を確認
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: "今日の勤怠記録が見つかりません" });
    }

    // 状態を出社中に更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "checked_in",
        lastUpdated: now,
      },
    });

    console.log("再出社処理完了");

    return res.status(200).json({
      success: true,
      message: "再出社しました",
      currentState: "checked_in",
    });
  } catch (error) {
    console.error("Error rechecking in:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
