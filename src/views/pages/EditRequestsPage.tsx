/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import type { TimeEditRequest } from "../../types.ts";

interface EditRequestWithUser extends TimeEditRequest {
  userName?: string;
}

export interface EditRequestsPageProps {
  requests: EditRequestWithUser[];
  successMessage?: string;
  errorMessage?: string;
}

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";

  // HH:mm形式の場合はそのまま表示
  if (typeof isoString === "string" && isoString.match(/^\d{1,2}:\d{2}$/)) {
    return isoString;
  }

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${y}/${m}/${d} ${h}:${min}`;
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    checkIn: "出社時間",
    checkOut: "退社時間",
    breakStart: "休憩開始時間",
    breakEnd: "休憩終了時間",
  };
  return labels[field] || field;
}

export const EditRequestsPage: FC<EditRequestsPageProps> = ({
  requests,
  successMessage,
  errorMessage,
}) => {
  return (
    <div class="max-w-7xl mx-auto">
      <div class="bg-white shadow-md rounded-lg p-6 mb-6">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold text-gray-800">時刻修正申請一覧</h1>

          <div class="flex space-x-2">
            <a
              href="/admin"
              class="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
            >
              管理者ダッシュボードへ戻る
            </a>
            <a
              href="/admin/edit-requests"
              class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              更新
            </a>
          </div>
        </div>

        {successMessage && (
          <div class="mb-6 p-4 rounded-md bg-green-100 text-green-800 border-l-4 border-green-500">
            <div class="flex items-center">
              <svg
                class="h-5 w-5 mr-2 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {successMessage}
            </div>
          </div>
        )}

        {errorMessage && (
          <div class="mb-6 p-4 rounded-md bg-red-100 text-red-800 border-l-4 border-red-500">
            <div class="flex items-center">
              <svg
                class="h-5 w-5 mr-2 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              {errorMessage}
            </div>
          </div>
        )}

        <div class="bg-gray-50 rounded-lg p-6 overflow-x-auto">
          {requests.length === 0 ? (
            <p class="text-center py-8">申請はありません</p>
          ) : (
            <table class="min-w-full divide-y divide-gray-200 bg-white shadow-md rounded-lg">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申請日時
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ユーザー
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    修正項目
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    現在値
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    修正値
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    理由
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(request.createdAt)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {request.userName || "不明"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getFieldLabel(request.field)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(request.oldValue)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(request.newValue)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-[150px] break-words whitespace-normal">
                      {request.reason || "-"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
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
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium min-w-[160px]">
                      {request.status === "pending" && (
                        <div class="flex justify-end space-x-2 flex-nowrap">
                          <form
                            method="post"
                            action={`/api/admin/edit-requests/${request.id}/approve`}
                            style="display:inline;"
                          >
                            <button
                              type="submit"
                              class="text-green-600 hover:text-green-900 px-2 py-1 rounded border border-green-300 hover:bg-green-50"
                              onclick="return confirm('この申請を承認しますか？')"
                            >
                              承認
                            </button>
                          </form>
                          <form
                            method="post"
                            action={`/api/admin/edit-requests/${request.id}/reject`}
                            style="display:inline;"
                          >
                            <button
                              type="submit"
                              class="text-red-600 hover:text-red-900 px-2 py-1 rounded border border-red-300 hover:bg-red-50"
                              onclick="return confirm('この申請を拒否しますか？')"
                            >
                              拒否
                            </button>
                          </form>
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
  );
};
