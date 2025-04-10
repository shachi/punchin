// pages/api/attendance/state.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import dayjs from "../../../lib/dayjs";
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
    const jstNow = dayjs(now).tz("Asia/Tokyo");

    // 日本時間で業務日を判定
    const jstBusinessDate = jstNow.toDate();

    if (jstNow.hour() < 4) {
      jstBusinessDate.setDate(jstBusinessDate.getDate() - 1);
    }
    jstBusinessDate.setHours(0, 0, 0, 0);

    // JSTの業務日をUTCに変換（データベース比較用）
    const businessDate = dayjs(jstBusinessDate).tz("Asia/Tokyo");

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
      const jstLastUpdated = dayjs(lastUpdated).tz("Asia/Tokyo");

      lastUpdatedBusinessDate = jstLastUpdated.toDate();

      if (jstLastUpdated.hour() < 4) {
        lastUpdatedBusinessDate.setDate(lastUpdatedBusinessDate.getDate() - 1);
      }
      lastUpdatedBusinessDate.setHours(0, 0, 0, 0);

      // JSTの最終更新業務日をUTCに変換（比較用）
      lastUpdatedBusinessDate = dayjs(lastUpdatedBusinessDate).tz("Asia/Tokyo");
    }

    console.log("最終更新業務日:", lastUpdatedBusinessDate);
    console.log("現在の状態:", userState.currentState);

    // 業務日が変わった場合は状態をリセット
    let stateChanged = false;
    if (
      lastUpdatedBusinessDate &&
      businessDate.toDate().getTime() >
        lastUpdatedBusinessDate.toDate().getTime() &&
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
    const businessDayStart = businessDate.toDate();
    const businessDayEnd = businessDate
      .add(1, "day")
      .hour(3)
      .minute(59)
      .second(59)
      .millisecond(999)
      .toDate();

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
    // エラーログをより詳細に
    console.error("Error processing state request:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );

    // もっと具体的なエラーメッセージを返す
    const errorMessage =
      error instanceof Error
        ? `サーバーエラー: ${error.message}`
        : "サーバーエラーが発生しました";

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
}
