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

    // セッション情報のデバッグ
    console.log("セッション情報:", {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });

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

    // ユーザーが存在するか確認（エラーを返さない）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      console.warn(`ユーザーID ${userId} が見つかりません`);
      // ユーザーがいない場合も404を返さずに、フロントエンドで表示できる情報を返す
      return res.status(200).json({
        success: false,
        message:
          "ユーザー情報が見つかりません。ログアウト後に再度ログインしてください。",
        currentState: "not_checked_in",
        record: null,
        dateChanged: false,
      });
    }

    // 状態がない場合は作成
    if (!userState) {
      try {
        console.log("ユーザー状態を新規作成します");
        const newState = await prisma.userState.create({
          data: {
            userId, // 既に存在するユーザーID
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
      } catch (createError) {
        console.error("ユーザー状態の作成に失敗:", createError);
        // エラーが発生しても200を返してフロントエンドでハンドリングできるようにする
        return res.status(200).json({
          success: false,
          message:
            "ユーザー状態の作成に失敗しました。しばらく経ってから再度お試しください。",
          currentState: "not_checked_in",
          record: null,
          dateChanged: false,
        });
      }
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
    // エラーが発生しても200を返してフロントエンドでハンドリングできるようにする
    return res.status(200).json({
      success: false,
      message: "サーバーエラーが発生しました",
      currentState: "not_checked_in",
      record: null,
      dateChanged: false,
    });
  }
}
