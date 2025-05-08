// pages/api/admin/edit-requests.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";
import dayjs from "../../../lib/dayjs";

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

    if (!session.user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "管理者権限が必要です" });
    }

    // クエリパラメータ
    const { status = "pending" } = req.query;

    // 修正申請一覧を取得
    const requests = await prisma.timeEditRequest.findMany({
      where: status !== "all" ? { status: String(status) } : {},
      orderBy: [
        { status: "asc" }, // 保留中を先頭に
        { createdAt: "desc" }, // 新しい順
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 日本時間に変換したデータをログ出力
    console.log(
      "管理者向け修正申請一覧 (JST):",
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
        createdAt: dayjs(req.createdAt)
          .tz("Asia/Tokyo")
          .format("YYYY-MM-DD HH:mm:ss Z"),
      })),
    );

    // 日本時間のタイムスタンプに変換してからクライアントに返す
    const formattedRequests = requests.map((req) => ({
      ...req,
      oldValue: req.oldValue
        ? dayjs(req.oldValue).tz("Asia/Tokyo").toISOString()
        : null,
      newValue: dayjs(req.newValue).tz("Asia/Tokyo").toISOString(),
      createdAt: dayjs(req.createdAt).tz("Asia/Tokyo").toISOString(),
    }));

    return res.status(200).json({
      success: true,
      requests: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching edit requests:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
