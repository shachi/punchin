// pages/api/attendance/check-out.ts
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
    console.log("退社処理開始 - ユーザーID:", userId);

    // ユーザー状態を確認
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("現在のユーザー状態:", userState);

    if (userState?.currentState !== "checked_in") {
      return res
        .status(400)
        .json({ success: false, message: "出社状態でないと退社できません" });
    }

    // 現在時刻（JST）
    const now = dayjs().tz("Asia/Tokyo");
    console.log("現在時刻:", now.format());

    // 業務日の計算（AM4時を境界とする）
    const businessDate =
      now.hour() < 4
        ? now.subtract(1, "day").startOf("day")
        : now.startOf("day");

    console.log("業務日:", businessDate.format());

    // 業務日の範囲
    const businessDayStart = businessDate.toDate();
    const businessDayEnd = businessDate
      .add(1, "day")
      .hour(3)
      .minute(59)
      .second(59)
      .millisecond(999)
      .toDate();

    console.log("業務日開始:", dayjs(businessDayStart).format());
    console.log("業務日終了:", dayjs(businessDayEnd).format());

    // 記録を検索
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    console.log("取得した記録:", record);

    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: "出社記録が見つかりません" });
    }

    // 退社時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOut: now.toDate(),
      },
    });

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "checked_out",
        lastUpdated: now.toDate(),
      },
    });

    console.log("退社処理完了");

    return res.status(200).json({
      success: true,
      message: "退社しました",
      currentState: "checked_out",
    });
  } catch (error) {
    console.error("Error checking out:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
