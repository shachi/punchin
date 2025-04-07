// pages/api/attendance/check-in.ts
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

    if (userState?.currentState !== "not_checked_in") {
      return res
        .status(400)
        .json({ success: false, message: "既に出社済みです" });
    }

    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 既存の記録を確認または作成
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
      record = await prisma.attendanceRecord.create({
        data: {
          userId,
          date: today,
        },
      });
    }

    // 出社時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkIn: new Date(),
        isAbsent: false,
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
      message: "出社しました",
      currentState: "checked_in",
    });
  } catch (error) {
    console.error("Error checking in:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
