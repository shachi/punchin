// pages/api/attendance/check-out.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
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

    // ユーザー状態を確認
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    if (userState?.currentState !== "checked_in") {
      return res
        .status(400)
        .json({ success: false, message: "出社状態でないと退社できません" });
    }

    // 今日の記録を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: "出社記録が見つかりません" });
    }

    // 退社時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOut: new Date(),
      },
    });

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "checked_out",
        lastUpdated: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "退社しました",
      currentState: "checked_out",
    });
  } catch (error) {
    console.error("Error checking out:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
