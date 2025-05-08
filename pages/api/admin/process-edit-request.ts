// pages/api/admin/process-edit-request.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import dayjs from "../../../lib/dayjs";
import { AttendanceRecord } from "@prisma/client";

// フィールドの型を安全に指定するための型
type AttendanceTimeField = "checkIn" | "checkOut" | "breakStart" | "breakEnd";

// フィールド名からプロパティを安全に取得する関数
function getTimeFieldValue(
  record: AttendanceRecord | null,
  fieldName: string,
): Date | null {
  if (!record) return null;

  switch (fieldName) {
    case "checkIn":
      return record.checkIn;
    case "checkOut":
      return record.checkOut;
    case "breakStart":
      return record.breakStart;
    case "breakEnd":
      return record.breakEnd;
    default:
      return null;
  }
}

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

    if (!session.user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "管理者権限が必要です" });
    }

    const { requestId, action } = req.body;

    // パラメータの確認
    if (!requestId || !action) {
      return res.status(400).json({
        success: false,
        message: "必要なパラメータが不足しています",
      });
    }

    // アクションの確認
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({
        success: false,
        message: "無効なアクションです",
      });
    }

    // 修正申請を取得
    const request = await prisma.timeEditRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "申請が見つかりません",
      });
    }

    // 申請が既に処理済みかチェック
    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "この申請は既に処理されています",
      });
    }

    // フィールド名のバリデーション
    if (
      !["checkIn", "checkOut", "breakStart", "breakEnd"].includes(request.field)
    ) {
      return res.status(400).json({
        success: false,
        message: "無効なフィールドです",
      });
    }

    // 修正申請のフィールドを型安全に扱う
    const fieldName = request.field as AttendanceTimeField;

    // デバッグログ：申請内容の確認
    console.log("処理する修正申請:", {
      id: request.id,
      field: fieldName,
      oldValue: request.oldValue
        ? dayjs(request.oldValue).tz("Asia/Tokyo").format("YYYY-MM-DD HH:mm:ss")
        : null,
      newValue: dayjs(request.newValue)
        .tz("Asia/Tokyo")
        .format("YYYY-MM-DD HH:mm:ss"),
    });

    // トランザクションで申請処理
    await prisma.$transaction(async (tx) => {
      // 申請ステータスを更新
      await tx.timeEditRequest.update({
        where: { id: requestId },
        data: {
          status: action === "approve" ? "approved" : "rejected",
        },
      });

      // 承認の場合は勤怠データを更新
      if (action === "approve") {
        // 型安全な方法でフィールドを更新
        const fieldToUpdate: Record<AttendanceTimeField, Date> = {
          [fieldName]: request.newValue,
        } as Record<AttendanceTimeField, Date>;

        // 更新前のデータを取得
        const recordBefore = await tx.attendanceRecord.findUnique({
          where: { id: request.recordId },
        });

        // 更新前のデータログ
        const oldValue = getTimeFieldValue(recordBefore, fieldName);
        console.log("更新前のレコード:", {
          id: recordBefore?.id,
          fieldName: oldValue
            ? dayjs(oldValue).tz("Asia/Tokyo").format("YYYY-MM-DD HH:mm:ss")
            : null,
        });

        // レコード更新
        const updatedRecord = await tx.attendanceRecord.update({
          where: { id: request.recordId },
          data: fieldToUpdate,
        });

        // 更新後のデータログ
        const newValue = getTimeFieldValue(updatedRecord, fieldName);
        console.log("更新後のレコード:", {
          id: updatedRecord.id,
          fieldName: newValue
            ? dayjs(newValue).tz("Asia/Tokyo").format("YYYY-MM-DD HH:mm:ss")
            : null,
        });
      }
    });

    return res.status(200).json({
      success: true,
      message:
        action === "approve" ? "申請を承認しました" : "申請を拒否しました",
    });
  } catch (error) {
    console.error("Error processing edit request:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
