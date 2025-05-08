// pages/admin/edit-requests.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dayjs from "../../lib/dayjs";
import Layout from "../../components/Layout";

interface User {
  id: string;
  name: string;
  email: string;
}

interface EditRequest {
  id: string;
  userId: string;
  recordId: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
  status: string;
  createdAt: string;
  user: User;
}

export default function EditRequests() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // リクエスト取得
  const fetchRequests = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/edit-requests");

      if (!response.ok) {
        throw new Error("申請の取得に失敗しました");
      }

      const data = await response.json();
      if (data.success) {
        setRequests(data.requests);
      } else {
        setError(data.message || "申請データの取得に失敗しました");
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  // 申請処理（承認/拒否）
  const processRequest = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    if (
      !confirm(`この申請を${action === "approve" ? "承認" : "拒否"}しますか？`)
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/process-edit-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          action,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(
          data.message ||
            `申請を${action === "approve" ? "承認" : "拒否"}しました`,
        );
        fetchRequests(); // 一覧を更新
      } else {
        alert(data.message || "処理に失敗しました");
      }
    } catch (err) {
      console.error("Error processing request:", err);
      alert("処理中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  // フィールド名の日本語表示
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      checkIn: "出社時間",
      checkOut: "退社時間",
      breakStart: "休憩開始時間",
      breakEnd: "休憩終了時間",
    };
    return labels[field] || field;
  };

  // 時刻フォーマット（日本時間）
  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    try {
      return dayjs(dateStr).tz("Asia/Tokyo").format("HH:mm:ss");
    } catch (err) {
      console.error("Time format error:", err, dateStr);
      return "-";
    }
  };

  // 日時フォーマット（日本時間）
  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    try {
      return dayjs(dateStr).tz("Asia/Tokyo").format("YYYY/MM/DD HH:mm");
    } catch (err) {
      console.error("DateTime format error:", err, dateStr);
      return "-";
    }
  };

  // コンポーネントマウント時とセッション確立時に申請を取得
  useEffect(() => {
    if (status === "authenticated" && session?.user?.isAdmin) {
      fetchRequests();
    } else if (status === "authenticated" && !session?.user?.isAdmin) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // 管理者でない場合はダッシュボードにリダイレクト
  if (status === "loading") {
    return <div className="text-center py-10">読み込み中...</div>;
  }

  if (status === "authenticated" && !session?.user?.isAdmin) {
    return null; // useEffectでリダイレクト
  }

  return (
    <Layout title="時刻修正申請" requireAuth requireAdmin>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              時刻修正申請一覧
            </h1>

            <div className="flex space-x-2">
              <button
                onClick={() => router.push("/admin")}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
              >
                管理者ダッシュボードへ戻る
              </button>

              <button
                onClick={fetchRequests}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
                disabled={isLoading}
              >
                {isLoading ? "読込中..." : "更新"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
              <p>{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 overflow-x-auto">
            {isLoading ? (
              <p className="text-center py-8">読み込み中...</p>
            ) : requests.length === 0 ? (
              <p className="text-center py-8">申請はありません</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 bg-white shadow-md rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申請日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      修正項目
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      現在値
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      修正値
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      理由
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(request.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.user?.name || "不明"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getFieldLabel(request.field)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(request.oldValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(request.newValue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {request.reason || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            request.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : request.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {request.status === "pending"
                            ? "保留中"
                            : request.status === "approved"
                              ? "承認済"
                              : "拒否済"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {request.status === "pending" && (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() =>
                                processRequest(request.id, "approve")
                              }
                              className="text-green-600 hover:text-green-900 px-2 py-1 rounded border border-green-300 hover:bg-green-50"
                              disabled={isLoading}
                            >
                              承認
                            </button>
                            <button
                              onClick={() =>
                                processRequest(request.id, "reject")
                              }
                              className="text-red-600 hover:text-red-900 px-2 py-1 rounded border border-red-300 hover:bg-red-50"
                              disabled={isLoading}
                            >
                              拒否
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
