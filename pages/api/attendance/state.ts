// pages/api/attendance/state.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
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
    const businessDate = fromZonedTime(jstBusinessDate, "Asia/Tokyo");

    console.log("現在時刻(JST):", jstNow);
    console.log("業務日(JST):", jstBusinessDate);
    console.log("業務日(UTC):", businessDate);

    // ユーザー状態を取得
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("ユーザー状態:", userState);

    // 状態がない場合は作成
    if (!userState) {
      const newState = await prisma.userState.create({
        data: {
          userId,
          currentState: "not_checked_in",
          lastUpdated: now,
        },
      });

      return res.status(200).json({
        success: true,
        currentState: "not_checked_in",
        record: null,
        dateChanged: false,
      });
    }

    // 状態の最終更新日の業務日を計算（JSTベース）
    let lastUpdatedBusinessDate = null;
    if (userState?.lastUpdated) {
      const lastUpdated = new Date(userState.lastUpdated);
      const jstLastUpdated = toZonedTime(lastUpdated, "Asia/Tokyo");

      lastUpdatedBusinessDate = new Date(jstLastUpdated);

      if (jstLastUpdated.getHours() < 4) {
        lastUpdatedBusinessDate.setDate(lastUpdatedBusinessDate.getDate() - 1);
      }
      lastUpdatedBusinessDate.setHours(0, 0, 0, 0);

      // JSTの最終更新業務日をUTCに変換（比較用）
      lastUpdatedBusinessDate = fromZonedTime(
        lastUpdatedBusinessDate,
        "Asia/Tokyo",
      );
    }

    console.log("最終更新業務日:", lastUpdatedBusinessDate);
    console.log("現在の状態:", userState.currentState);

    // 業務日が変わった場合は状態をリセット
    let stateChanged = false;
    if (
      lastUpdatedBusinessDate &&
      businessDate.getTime() > lastUpdatedBusinessDate.getTime() &&
      userState.currentState !== "not_checked_in"
    ) {
      console.log("業務日が変わったため状態をリセットします");

      await prisma.userState.update({
        where: { userId },
        data: {
          currentState: "not_checked_in",
          lastUpdated: now,
        },
      });

      stateChanged = true;
    }

    // 最新の状態（リセットした場合は "not_checked_in"）
    const currentState = stateChanged
      ? "not_checked_in"
      : userState.currentState;

    // 業務日の記録を検索
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
    console.log("業務日の記録:", record);

    // クライアントに最新の状態を返す
    return res.status(200).json({
      success: true,
      currentState,
      record,
      dateChanged: stateChanged,
      lastUpdated: now.toISOString(), // 最終更新時刻も返す
    });
  } catch (error) {
    console.error("Error fetching user state:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
