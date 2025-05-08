// pages/api/admin/edit-requests.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
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

    return res.status(200).json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error("Error fetching edit requests:", error);
    return res
      .status(500)
      .json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
