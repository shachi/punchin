// pages/api/attendance/check-in.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import dayjs from "../../../lib/dayjs";
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

    // 現在の日時と業務日を取得（日本時間ベース）
    const now = dayjs().tz("Asia/Tokyo");

    // 業務日の計算（AM4時を境界とする）
    const businessDate =
      now.hour() < 4
        ? now.subtract(1, "day").startOf("day")
        : now.startOf("day");

    // 業務日の範囲
    const businessDayStart = businessDate.toDate();
    const businessDayEnd = businessDate
      .add(1, "day")
      .hour(3)
      .minute(59)
      .second(59)
      .millisecond(999)
      .toDate();

    // まず状態をリセットするかチェック
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    // 状態の最終更新日
    let lastUpdatedBusinessDate = null;
    if (userState?.lastUpdated) {
      const lastUpdated = new Date(userState.lastUpdated);
      lastUpdatedBusinessDate = new Date(lastUpdated);

      if (lastUpdated.getHours() < 4) {
        lastUpdatedBusinessDate.setDate(lastUpdatedBusinessDate.getDate() - 1);
      }
      lastUpdatedBusinessDate.setHours(0, 0, 0, 0);
    }
    // 業務日が変わった場合は状態をリセット
    if (
      lastUpdatedBusinessDate &&
      businessDate.get("date") > lastUpdatedBusinessDate.getTime() &&
      userState?.currentState !== "not_checked_in"
    ) {
      console.log("Resetting state due to business day change");

      await prisma.userState.update({
        where: { userId },
        data: {
          currentState: "not_checked_in",
          lastUpdated: now.toDate(),
        },
      });
    }

    // 最新の状態を再取得
    const updatedUserState = await prisma.userState.findUnique({
      where: { userId },
    });

    // ここで改めて状態チェック
    if (updatedUserState?.currentState !== "not_checked_in") {
      return res.status(400).json({
        success: false,
        message: "既に出社済みです",
        currentState: updatedUserState?.currentState,
      });
    }

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
          checkIn: now.toDate(),
          isAbsent: false,
        },
      });
    }

    // 出社時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkIn: now.toDate(),
        isAbsent: false,
      },
    });

    console.log("更新/作成された記録:", record);

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "checked_in",
        lastUpdated: now.toDate(),
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
