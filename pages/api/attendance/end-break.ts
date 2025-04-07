// pages/api/attendance/end-break.ts
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

    if (userState?.currentState !== "on_break") {
      return res
        .status(400)
        .json({
          success: false,
          message: "休憩中でないと休憩を終了できません",
        });
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

    // 休憩終了時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        breakEnd: new Date(),
      },
    });

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "checked_in",
        lastUpdated: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "休憩を終了しました",
      currentState: "checked_in",
    });
  } catch (error) {
    console.error("Error ending break:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
