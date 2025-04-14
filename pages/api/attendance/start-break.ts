// pages/api/attendance/start-break.ts
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
    console.log("休憩開始処理開始 - ユーザーID:", userId);

    // ユーザー状態を確認
    const userState = await prisma.userState.findUnique({
      where: { userId },
    });

    console.log("現在のユーザー状態:", userState);

    if (userState?.currentState !== "checked_in") {
      return res.status(400).json({
        success: false,
        message: "出社状態でないと休憩を開始できません",
      });
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
    let record = await prisma.attendanceRecord.findFirst({
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
      console.log("出社記録が見つからないため、新規作成します");
      record = await prisma.attendanceRecord.create({
        data: {
          userId,
          date: businessDayStart,
          checkIn: now.toDate(),
        },
      });
      console.log("新規作成した記録:", record);
    }

    // 明示的なチェックを追加
    if (!record.checkIn) {
      console.log("出社時間が記録されていません");

      // 出社時間がない場合は記録
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkIn: now.toDate(), // 現在時刻を出社時間として設定
        },
      });

      console.log("出社時間を追加しました:", record);
    }

    // 休憩開始時間を記録
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        breakStart: now.toDate(),
      },
    });

    // ユーザー状態を更新
    await prisma.userState.update({
      where: { userId },
      data: {
        currentState: "on_break",
        lastUpdated: now.toDate(),
      },
    });

    console.log("休憩開始処理完了");

    return res.status(200).json({
      success: true,
      message: "休憩を開始しました",
      currentState: "on_break",
    });
  } catch (error) {
    console.error("Error starting break:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
