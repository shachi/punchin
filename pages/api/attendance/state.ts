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

    // 現在時刻（JST）
    const now = dayjs().tz("Asia/Tokyo");
    console.log("現在時刻(JST):", now.format("YYYY-MM-DD HH:mm:ss"));

    // 業務日の計算（AM4時を境界とする）
    const businessDate =
      now.hour() < 4
        ? now.subtract(1, "day").startOf("day")
        : now.startOf("day");

    console.log("業務日:", businessDate.format("YYYY-MM-DD"));

    // ユーザー状態を取得
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("現在のユーザー状態:", userState?.currentState);

    // 状態がない場合は作成
    if (!userState) {
      const newState = await prisma.userState.create({
        data: {
          userId,
          currentState: "not_checked_in",
          lastUpdated: now.toDate(),
        },
      });

      return res.status(200).json({
        success: true,
        currentState: "not_checked_in",
        record: null,
        dateChanged: false,
      });
    }

    // 前回更新時の業務日を計算（JSTベース）
    const lastUpdated = dayjs(userState.lastUpdated).tz("Asia/Tokyo");
    console.log(
      "最終更新時刻(JST):",
      lastUpdated.format("YYYY-MM-DD HH:mm:ss"),
    );

    const lastBusinessDate =
      lastUpdated.hour() < 4
        ? lastUpdated.subtract(1, "day").startOf("day")
        : lastUpdated.startOf("day");

    console.log("前回の業務日:", lastBusinessDate.format("YYYY-MM-DD"));

    // 業務日が変わったかどうか（日付比較）
    const dateChanged = !businessDate.isSame(lastBusinessDate, "day");
    console.log(
      "業務日変更判定:",
      businessDate.format("YYYY-MM-DD"),
      "vs",
      lastBusinessDate.format("YYYY-MM-DD"),
      dateChanged ? "変更あり" : "変更なし",
    );

    // デバッグ用の詳細情報
    console.log("現在時刻のhour:", now.hour());
    console.log("最終更新時刻のhour:", lastUpdated.hour());

    // 業務日が変わった場合は状態をリセット
    let currentState = userState.currentState;

    if (dateChanged && userState.currentState !== "not_checked_in") {
      console.log("業務日が変わったため、状態をリセットします");

      await prisma.userState.update({
        where: { userId },
        data: {
          currentState: "not_checked_in",
          lastUpdated: now.toDate(),
        },
      });

      currentState = "not_checked_in";
    } else {
      console.log(
        "業務日は変わっていないため、状態を維持します:",
        userState.currentState,
      );
    }

    // 今日の勤怠記録を検索
    const businessDayStart = businessDate.toDate();
    const businessDayEnd = businessDate
      .add(1, "day")
      .hour(3)
      .minute(59)
      .second(59)
      .millisecond(999)
      .toDate();

    console.log(
      "業務日の範囲:",
      dayjs(businessDayStart).format("YYYY-MM-DD HH:mm:ss"),
      "から",
      dayjs(businessDayEnd).format("YYYY-MM-DD HH:mm:ss"),
    );

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    console.log("今日の記録:", record ? "あり" : "なし");

    return res.status(200).json({
      success: true,
      currentState,
      record,
      dateChanged,
    });
  } catch (error) {
    console.error("Error fetching user state:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
