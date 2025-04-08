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

    // 現在の日時を取得
    const now = new Date();

    // 業務日の区切り時間を設定（AM4:00）
    // 現在時刻が4時前なら前日の日付、4時以降なら当日の日付
    const businessDate = new Date(now);
    if (now.getHours() < 4) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    businessDate.setHours(0, 0, 0, 0);

    console.log("現在の日時:", now);
    console.log("業務日:", businessDate);

    // ユーザー状態を取得
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("ユーザー状態:", userState);

    // 状態の最終更新日
    let lastUpdatedDate = null;
    if (userState?.lastUpdated) {
      lastUpdatedDate = new Date(userState.lastUpdated);
      // 4時前なら前日の日付、4時以降なら当日の日付
      if (lastUpdatedDate.getHours() < 4) {
        lastUpdatedDate.setDate(lastUpdatedDate.getDate() - 1);
      }
      lastUpdatedDate.setHours(0, 0, 0, 0);
    }

    console.log("状態の最終更新業務日:", lastUpdatedDate);

    // 日付が変わっていて、かつ何らかの状態がある場合はリセット
    let shouldResetState = false;
    let newState = userState?.currentState || "not_checked_in";

    if (lastUpdatedDate && businessDate.getTime() > lastUpdatedDate.getTime()) {
      // 業務日が変わっている場合は無条件でリセット
      shouldResetState = true;
      newState = "not_checked_in";
      console.log("日付が変わったため状態をリセットします");
    }

    if (shouldResetState) {
      // 状態をリセット
      await prisma.userState.update({
        where: { userId },
        data: {
          currentState: "not_checked_in",
          lastUpdated: now,
        },
      });

      console.log("状態をリセットしました");
    }

    // 強制的に最新の状態を再取得
    const updatedUserState = shouldResetState
      ? await prisma.userState.findUnique({ where: { userId } })
      : userState;

    // 今日の記録を取得
    // 業務日の開始（AM4:00）から翌日のAM3:59:59まで
    const businessDayStart = new Date(businessDate);
    const businessDayEnd = new Date(businessDate);
    businessDayEnd.setDate(businessDayEnd.getDate() + 1);
    businessDayEnd.setHours(3, 59, 59, 999);

    console.log("業務日の範囲:", businessDayStart, "から", businessDayEnd);

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    console.log("現在の業務日の記録:", record);

    // 状態が更新された場合は新しい状態を返す
    const currentState = shouldResetState
      ? "not_checked_in"
      : userState?.currentState || "not_checked_in";

    return res.status(200).json({
      success: true,
      currentState: updatedUserState?.currentState || "not_checked_in",
      record,
      dateChanged: shouldResetState, // 日付変更があったことをクライアントに伝える
    });
  } catch (error) {
    console.error("Error fetching user state:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
