/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import type { AttendanceRecord } from "../../types.ts";
import { Clock } from "../components/Clock.tsx";
import { AttendanceButtons, StatusBadge } from "../components/AttendanceButtons.tsx";

export type UserStateType = "not_checked_in" | "checked_in" | "on_break" | "checked_out" | "absent";

interface Message {
  text: string;
  type: "success" | "error" | "info" | "warning";
}

interface DashboardContentProps {
  currentState: UserStateType;
  record?: AttendanceRecord | null;
  message?: Message | null;
  editRequests?: Array<{ id: string; field: string; status: string }>;
}

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    checkIn: "出社時間",
    checkOut: "退社時間",
    breakStart: "休憩開始",
    breakEnd: "休憩終了",
  };
  return labels[field] || field;
}

function EditRequestStatus({ field, requests }: { field: string; requests?: Array<{ field: string; status: string }> }) {
  if (!requests?.length) return null;
  const request = requests.find((r) => r.field === field);
  if (!request) return null;

  const statusConfig: Record<string, { text: string; class: string }> = {
    pending: { text: "承認待ち", class: "bg-yellow-100 text-yellow-800" },
    approved: { text: "承認済み", class: "bg-green-100 text-green-800" },
    rejected: { text: "拒否", class: "bg-red-100 text-red-800" },
  };

  const config = statusConfig[request.status] || { text: request.status, class: "bg-gray-100 text-gray-800" };

  return (
    <span class={`ml-2 text-xs px-2 py-1 rounded-full ${config.class}`}>
      {config.text}
    </span>
  );
}

function MessageAlert({ message }: { message: Message }) {
  const configs: Record<string, { bg: string; border: string; icon: string }> = {
    success: {
      bg: "bg-green-100 text-green-800",
      border: "border-green-500",
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />`,
    },
    error: {
      bg: "bg-red-100 text-red-800",
      border: "border-red-500",
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />`,
    },
    warning: {
      bg: "bg-yellow-100 text-yellow-800",
      border: "border-yellow-500",
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`,
    },
    info: {
      bg: "bg-blue-100 text-blue-800",
      border: "border-blue-500",
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
    },
  };

  const config = configs[message.type] || configs.info;

  return (
    <div class={`mb-6 p-4 rounded-md border-l-4 ${config.bg} ${config.border}`}>
      <div class="flex items-center">
        <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d={config.icon} />
        </svg>
        {message.text}
      </div>
    </div>
  );
}

export function DashboardContent({ currentState, record, message, editRequests }: DashboardContentProps) {
  return (
    <div id="dashboard-content">
      {message && <MessageAlert message={message} />}

      {/* 時計と状態 */}
      <div class="bg-gray-50 rounded-lg p-6 mb-6 text-center">
        <Clock />

        <div class="my-6">
          <div class="flex justify-between items-center mb-2">
            <h2 class="text-lg font-medium text-gray-700">現在の状態</h2>
            <button
              hx-get="/api/attendance/state"
              hx-target="#dashboard-content"
              hx-swap="innerHTML"
              class="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              更新
            </button>
          </div>
          <StatusBadge state={currentState} />
        </div>
      </div>

      {/* 勤怠ボタン */}
      <div class="bg-gray-50 rounded-lg p-6 mb-6">
        <h2 class="text-lg font-medium text-gray-700 mb-4">勤怠登録</h2>
        <AttendanceButtons currentState={currentState} />
      </div>

      {/* 今日の記録 */}
      {record && (
        <div class="bg-gray-50 rounded-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-medium text-gray-700">今日の記録</h2>
            <button
              onclick="openEditModal()"
              class="text-blue-600 hover:text-blue-800 text-sm flex items-center"
            >
              <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              修正申請
            </button>
          </div>

          <table class="min-w-full divide-y divide-gray-200">
            <tbody class="divide-y divide-gray-200">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 w-1/3">出社時間</th>
                <td class="px-4 py-3 text-sm text-gray-800">
                  {formatTime(record.checkIn)}
                  <EditRequestStatus field="checkIn" requests={editRequests} />
                </td>
              </tr>
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">休憩開始</th>
                <td class="px-4 py-3 text-sm text-gray-800">
                  {formatTime(record.breakStart)}
                  <EditRequestStatus field="breakStart" requests={editRequests} />
                </td>
              </tr>
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">休憩終了</th>
                <td class="px-4 py-3 text-sm text-gray-800">
                  {formatTime(record.breakEnd)}
                  <EditRequestStatus field="breakEnd" requests={editRequests} />
                </td>
              </tr>
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">退社時間</th>
                <td class="px-4 py-3 text-sm text-gray-800">
                  {formatTime(record.checkOut)}
                  <EditRequestStatus field="checkOut" requests={editRequests} />
                </td>
              </tr>
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">欠勤</th>
                <td class="px-4 py-3 text-sm text-gray-800">
                  {record.isAbsent ? "はい" : "いいえ"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 時刻修正モーダル */}
      {record && (
        <div id="edit-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 class="text-xl font-bold mb-4">打刻時間修正申請</h2>
            
            <form
              hx-post="/api/attendance/edit-request"
              hx-target="#dashboard-content"
              hx-swap="innerHTML"
              class="space-y-4"
            >
              <input type="hidden" name="recordId" value={record.id} />
              
              <div>
                <label class="block text-gray-700 mb-2">修正したい項目</label>
                <select name="field" required class="w-full border rounded py-2 px-3">
                  <option value="">選択してください</option>
                  <option value="checkIn">出社時間</option>
                  <option value="checkOut">退社時間</option>
                  <option value="breakStart">休憩開始時間</option>
                  <option value="breakEnd">休憩終了時間</option>
                </select>
              </div>

              <div>
                <label class="block text-gray-700 mb-2">新しい時間 (JST)</label>
                <input type="time" name="newValue" required class="w-full border rounded py-2 px-3" />
              </div>

              <div>
                <label class="block text-gray-700 mb-2">修正理由</label>
                <textarea name="reason" required rows={3} class="w-full border rounded py-2 px-3" placeholder="修正理由を入力してください"></textarea>
              </div>

              <div class="flex justify-end space-x-3">
                <button
                  type="button"
                  onclick="closeEditModal()"
                  class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
                >
                  申請する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* モーダル操作スクリプト */}
      <script dangerouslySetInnerHTML={{
        __html: `
          function openEditModal() {
            document.getElementById('edit-modal').classList.remove('hidden');
          }
          function closeEditModal() {
            document.getElementById('edit-modal').classList.add('hidden');
          }
        `
      }} />
    </div>
  );
}
