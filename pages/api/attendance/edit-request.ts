// pages/api/attendance/edit-request.ts
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
    // セッション確認
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: "認証が必要です" });
    }

    const userId = session.user.id;
    const { recordId, field, newValue, reason } = req.body;

    // 入力値のバリデーション
    if (!recordId || !field || !newValue || !reason) {
      return res.status(400).json({
        success: false,
        message: "必要なパラメータが不足しています",
      });
    }

    // フィールド名のバリデーション
    const validFields = ["checkIn", "checkOut", "breakStart", "breakEnd"];
    if (!validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "無効なフィールド名です",
      });
    }

    // 指定されたレコードが存在するか確認
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "指定された勤怠記録が見つかりません",
      });
    }

    // レコードがユーザー自身のものか確認
    if (record.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "他のユーザーの勤怠記録は修正できません",
      });
    }

    // ここでクライアントから送られてきた日時を日本時間として解釈
    // クライアント側から送られる日時がISO形式で、タイムゾーン情報が含まれている場合
    const parsedNewValue = dayjs(newValue).tz("Asia/Tokyo");

    if (!parsedNewValue.isValid()) {
      return res.status(400).json({
        success: false,
        message: "無効な日時形式です",
      });
    }

    // タイムゾーン情報をログ出力して確認
    console.log("受信した時間値:", newValue);
    console.log(
      "パース後の日本時間:",
      parsedNewValue.format("YYYY-MM-DD HH:mm:ss"),
    );
    console.log("UTC時間に変換:", parsedNewValue.toDate());

    // 現在の値を取得
    let oldValue = null;
    switch (field) {
      case "checkIn":
        oldValue = record.checkIn;
        break;
      case "checkOut":
        oldValue = record.checkOut;
        break;
      case "breakStart":
        oldValue = record.breakStart;
        break;
      case "breakEnd":
        oldValue = record.breakEnd;
        break;
    }

    // 修正申請を作成
    const editRequest = await prisma.timeEditRequest.create({
      data: {
        userId,
        recordId,
        field,
        oldValue,
        newValue: parsedNewValue.toDate(), // 日本時間を正しくDateオブジェクトに変換
        reason,
        status: "pending", // 初期状態は「保留中」
      },
    });

    console.log(`修正申請が作成されました: ${editRequest.id}`);

    return res.status(200).json({
      success: true,
      message: "修正申請を受け付けました",
      request: {
        id: editRequest.id,
        field,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Error creating edit request:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
