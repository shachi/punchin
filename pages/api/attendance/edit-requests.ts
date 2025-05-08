// pages/api/attendance/edit-requests.ts
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
    // セッション確認
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: "認証が必要です" });
    }

    const userId = session.user.id;

    // 現在の日本時間
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

    // 今日の勤怠記録を取得
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        userId,
        date: {
          gte: businessDayStart,
          lte: businessDayEnd,
        },
      },
    });

    if (!record) {
      return res.status(200).json({
        success: true,
        requests: [],
      });
    }

    // この記録に関連する修正申請を取得
    const requests = await prisma.timeEditRequest.findMany({
      where: {
        userId,
        recordId: record.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // タイムゾーン情報をデバッグログに出力
    console.log(
      "取得した修正申請:",
      requests.map((req) => ({
        id: req.id,
        field: req.field,
        oldValue: req.oldValue
          ? dayjs(req.oldValue).tz("Asia/Tokyo").format("YYYY-MM-DD HH:mm:ss Z")
          : null,
        newValue: dayjs(req.newValue)
          .tz("Asia/Tokyo")
          .format("YYYY-MM-DD HH:mm:ss Z"),
        status: req.status,
      })),
    );

    // クライアント側で使用する情報だけを抽出し、タイムゾーン情報を適切に処理
    const simplifiedRequests = requests.map((req) => ({
      id: req.id,
      field: req.field,
      status: req.status,
      createdAt: dayjs(req.createdAt).tz("Asia/Tokyo").format(), // 日本時間に変換して送信
    }));

    return res.status(200).json({
      success: true,
      requests: simplifiedRequests,
    });
  } catch (error) {
    console.error("Error fetching edit requests:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
