// attendance-deno/src/views/pages/AdminPage.tsx
/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

// 管理者ページはHTMX/クライアントサイドでデータ取得するシンプルなコンテナ
export const AdminPage: FC = () => {
  return (
    <div class="max-w-6xl mx-auto">
      <div class="bg-white shadow-md rounded-lg p-6 mb-6">
        <h1 class="text-2xl font-bold text-gray-800 mb-4">
          勤怠管理 - 管理者ダッシュボード
        </h1>

        {/* 月選択UI - HTMXで動的に更新 */}
        <div class="mb-6" id="month-selector">
          <div class="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <button
              hx-get="/api/admin/attendance"
              hx-target="#records-table"
              hx-include="[name='startDate'],[name='endDate']"
              class="text-blue-600 hover:text-blue-800"
              id="prev-month-btn"
            >
              ← 前月
            </button>
            <h2 class="text-xl font-semibold" id="month-display">
              {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
            </h2>
            <button
              hx-get="/api/admin/attendance"
              hx-target="#records-table"
              hx-include="[name='startDate'],[name='endDate']"
              class="text-blue-600 hover:text-blue-800"
              id="next-month-btn"
            >
              翌月 →
            </button>
          </div>
        </div>

        {/* アクションボタン */}
        <div class="flex justify-between mb-4">
          <div class="flex space-x-2">
            <a
              href="/api/admin/export-csv?type=monthly"
              id="export-csv-link"
              class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded flex items-center"
            >
              <svg class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              月次CSVエクスポート
            </a>

            <a
              href="/admin/edit-requests"
              class="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded flex items-center"
            >
              <svg class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              時刻修正申請
            </a>
          </div>
        </div>

        {/* 日付フィルタ */}
        <div class="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 class="text-lg font-medium text-gray-700 mb-4">勤怠記録</h2>

          <form 
            id="filter-form"
            hx-get="/api/admin/attendance"
            hx-target="#records-table"
            hx-trigger="submit"
            class="flex flex-wrap gap-4 mb-6"
          >
            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium text-gray-700 mb-1">開始日</label>
              <input
                type="date"
                name="startDate"
                id="startDate"
                class="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium text-gray-700 mb-1">終了日</label>
              <input
                type="date"
                name="endDate"
                id="endDate"
                class="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div class="flex items-end gap-2">
              <button
                type="submit"
                class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 shadow-sm"
              >
                表示
              </button>
            </div>
          </form>

          {/* テーブル（HTMX で更新） */}
          <div id="records-table" hx-get="/api/admin/attendance" hx-trigger="load" hx-swap="innerHTML">
            <div class="text-center py-8 text-gray-500">読み込み中...</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// サーバーサイドでテーブル部分をレンダリングするためのコンポーネント（APIから呼ばれる）
export const AdminRecordsTable: FC<{
  records: AdminRecordWithUser[];
  pagination: { currentPage: number; totalPages: number; total: number; pageSize: number };
  startDate: string;
  endDate: string;
}> = ({ records, pagination, startDate, endDate }) => {
  return (
    <>
      <div class="overflow-x-auto bg-white rounded-lg shadow">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出社時間</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">退社時間</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">休憩時間(分)</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">勤務時間</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">欠勤</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {records.length === 0 ? (
              <tr>
                <td colspan={7} class="px-6 py-4 text-center text-sm text-gray-500">
                  記録がありません
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(record.date)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.userName || "不明"}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(record.checkIn)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(record.checkOut)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateBreakMinutes(record)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateWorkHours(record)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.isAbsent ? (
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        はい
                      </span>
                    ) : (
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        いいえ
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <div class="mt-4">
          <div class="mt-2 text-sm text-gray-500 text-center">
            全{pagination.total}件中 {(pagination.currentPage - 1) * pagination.pageSize + 1}～
            {Math.min(pagination.currentPage * pagination.pageSize, pagination.total)}件を表示
          </div>
          <div class="flex items-center justify-center mt-4 space-x-2">
            <button
              hx-get={`/api/admin/attendance?startDate=${startDate}&endDate=${endDate}&page=${pagination.currentPage - 1}`}
              hx-target="#records-table"
              disabled={pagination.currentPage === 1}
              class={`px-3 py-1 border rounded ${pagination.currentPage === 1 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300 hover:bg-gray-100"}`}
            >
              前へ
            </button>
            
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  hx-get={`/api/admin/attendance?startDate=${startDate}&endDate=${endDate}&page=${page}`}
                  hx-target="#records-table"
                  class={`px-3 py-1 border rounded mx-1 ${page === pagination.currentPage ? "bg-blue-500 text-white" : "border-gray-300 hover:bg-gray-100"}`}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              hx-get={`/api/admin/attendance?startDate=${startDate}&endDate=${endDate}&page=${pagination.currentPage + 1}`}
              hx-target="#records-table"
              disabled={pagination.currentPage === pagination.totalPages}
              class={`px-3 py-1 border rounded ${pagination.currentPage === pagination.totalPages ? "text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300 hover:bg-gray-100"}`}
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ヘルパー関数
interface AdminRecordWithUser {
  id: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  isAbsent: boolean;
  userName?: string;
}

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${y}/${m.toString().padStart(2, "0")}/${d.toString().padStart(2, "0")} (${w})`;
}

function calculateWorkHours(record: AdminRecordWithUser): string {
  if (!record.checkIn || !record.checkOut) return "-";
  const checkIn = new Date(record.checkIn).getTime();
  const checkOut = new Date(record.checkOut).getTime();
  let totalMinutes = (checkOut - checkIn) / 60000;
  
  if (record.breakStart && record.breakEnd) {
    const breakStart = new Date(record.breakStart).getTime();
    const breakEnd = new Date(record.breakEnd).getTime();
    const breakMinutes = (breakEnd - breakStart) / 60000;
    totalMinutes -= breakMinutes;
  }
  
  return (totalMinutes / 60).toFixed(2);
}

function calculateBreakMinutes(record: AdminRecordWithUser): string {
  if (!record.breakStart || !record.breakEnd) return "-";
  const breakStart = new Date(record.breakStart).getTime();
  const breakEnd = new Date(record.breakEnd).getTime();
  return Math.round((breakEnd - breakStart) / 60000).toString();
}
