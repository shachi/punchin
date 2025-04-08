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

    // 現在の業務日を取得
    const now = new Date();
    const businessDate = new Date(now);
    if (now.getHours() < 4) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    businessDate.setHours(0, 0, 0, 0);

    // ユーザー状態を確認
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    // 状態の最終更新日を業務日に変換
    let lastUpdatedDate = null;
    if (userState?.lastUpdated) {
      lastUpdatedDate = new Date(userState.lastUpdated);
      if (lastUpdatedDate.getHours() < 4) {
        lastUpdatedDate.setDate(lastUpdatedDate.getDate() - 1);
      }
      lastUpdatedDate.setHours(0, 0, 0, 0);
    }

    // 日付が変わっている場合は状態をリセット
    if (lastUpdatedDate && businessDate.getTime() > lastUpdatedDate.getTime()) {
      console.log("日付が変わっているため状態をリセットします");
      await prisma.userState.update({
        where: { userId },
        data: {
          currentState: "not_checked_in",
          lastUpdated: now,
        },
      });
    }

    // 最新の状態を再取得
    const currentUserState = await prisma.userState.findUnique({
      where: { userId },
    });

    if (
      currentUserState?.currentState !== "not_checked_in" &&
      currentUserState?.currentState !== "checked_out"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "既に出社済みです" });
    }

    // 業務日の範囲を設定
    const businessDayStart = new Date(businessDate);
    const businessDayEnd = new Date(businessDate);
    businessDayEnd.setDate(businessDayEnd.getDate() + 1);
    businessDayEnd.setHours(3, 59, 59, 999);

    // 既存の記録を確認
    let record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    console.log("既存の記録:", record);

    // 記録がなければ作成
    if (!record) {
      console.log("記録が見つからないため新規作成します");
      record = await prisma.attendanceRecord.create({
        data: {
          userId,
          date: businessDayStart,
          checkIn: now,
          isAbsent: false,
        },
      });
    }

    // 出社時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkIn: now,
        isAbsent: false,
      },
    });

    console.log("更新/作成された記録:", record);

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "checked_in",
        lastUpdated: now,
      },
    });

    console.log("出社処理完了");

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
