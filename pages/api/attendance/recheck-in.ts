// pages/api/attendance/recheck-in.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import dayjs from "../../../lib/dayjs";

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

    // 現在時刻（JST）
    const now = dayjs().tz("Asia/Tokyo");

    // 業務日の計算（AM4時を境界とする）
    const businessDate =
      now.hour() < 4
        ? now.subtract(1, "day").startOf("day")
        : now.startOf("day");

    // 業務日の範囲
    const businessDayStart = businessDate.toDate();
    const businessDayEnd = businessDate
      .add(1, "day")
      .hour(3)
      .minute(59)
      .second(59)
      .millisecond(999)
      .toDate();

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
        lastUpdated: now.toDate(),
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
