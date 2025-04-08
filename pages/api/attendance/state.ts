// pages/api/attendance/state.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

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

    const userId = session.user.id;
    console.log("状態取得 - ユーザーID:", userId);

    // 業務日の境界チェック（AM4時）
    const now = new Date();
    const businessDate = new Date(now);

    if (now.getHours() < 4) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    businessDate.setHours(0, 0, 0, 0);

    // ユーザーの状態を取得
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });
    // 状態の最終更新日を取得
    let lastUpdatedBusinessDate = null;
    if (userState?.lastUpdated) {
      const lastUpdated = new Date(userState.lastUpdated);
      lastUpdatedBusinessDate = new Date(lastUpdated);

      if (lastUpdated.getHours() < 4) {
        lastUpdatedBusinessDate.setDate(lastUpdatedBusinessDate.getDate() - 1);
      }
      lastUpdatedBusinessDate.setHours(0, 0, 0, 0);
    }
    console.log("Current business date:", businessDate);
    console.log("Last updated business date:", lastUpdatedBusinessDate);
    console.log("Current user state:", userState?.currentState);

    // 業務日が変わった場合は状態をリセット
    let stateChanged = false;
    if (
      lastUpdatedBusinessDate &&
      businessDate.getTime() > lastUpdatedBusinessDate.getTime() &&
      userState?.currentState !== "not_checked_in"
    ) {
      console.log("Resetting state due to business day change");

      await prisma.userState.update({
        where: { userId },
        data: {
          currentState: "not_checked_in",
          lastUpdated: now,
        },
      });

      stateChanged = true;
    }
    // 最新の状態を再取得
    const currentState = stateChanged
      ? "not_checked_in"
      : userState?.currentState || "not_checked_in";

    // 業務日の範囲で記録を検索
    const businessDayStart = new Date(businessDate);
    const businessDayEnd = new Date(businessDate);
    businessDayEnd.setDate(businessDayEnd.getDate() + 1);
    businessDayEnd.setHours(3, 59, 59, 999);

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    console.log("Found attendance record:", record);

    return res.status(200).json({
      success: true,
      currentState,
      record,
      dateChanged: stateChanged,
    });
  } catch (error) {
    console.error("Error fetching user state:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
