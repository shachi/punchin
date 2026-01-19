// attendance-deno/src/views/components/AttendanceButtons.tsx
import type { FC } from "hono/jsx";
import type { UserStateType } from "../../types.ts";

interface AttendanceButtonsProps {
  currentState: UserStateType;
}

export const AttendanceButtons: FC<AttendanceButtonsProps> = ({ currentState }) => {
  return (
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">勤怠登録</h2>
      <div id="attendance-buttons" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ButtonsForState currentState={currentState} />
      </div>
      <div id="attendance-message" class="mt-4"></div>
    </div>
  );
};

const ButtonsForState: FC<{ currentState: UserStateType }> = ({ currentState }) => {
  const buttonClass = (color: string) =>
    `${color} text-white font-bold py-3 px-4 rounded disabled:opacity-50 transition duration-150`;
  
  const htmxAttrs = (action: string, confirm?: string) => ({
    "hx-post": `/api/attendance/${action}`,
    "hx-target": "#dashboard-content",
    "hx-swap": "innerHTML",
    ...(confirm ? { "hx-confirm": confirm } : {}),
  });

  switch (currentState) {
    case "not_checked_in":
      return (
        <>
          <button
            {...htmxAttrs("check-in")}
            class={buttonClass("bg-blue-500 hover:bg-blue-600")}
          >
            <span class="htmx-indicator">処理中...</span>
            <span class="htmx-indicator:hidden">出社</span>
          </button>
          <button
            {...htmxAttrs("absent", "本日を欠勤として記録しますか？")}
            class={buttonClass("bg-red-500 hover:bg-red-600")}
          >
            欠勤
          </button>
        </>
      );
    
    case "checked_in":
      return (
        <>
          <button
            {...htmxAttrs("start-break")}
            class={buttonClass("bg-yellow-500 hover:bg-yellow-600")}
          >
            休憩開始
          </button>
          <button
            {...htmxAttrs("check-out", "本当に今日の業務終了でよろしいでしょうか？")}
            class={buttonClass("bg-green-500 hover:bg-green-600")}
          >
            退社
          </button>
        </>
      );
    
    case "on_break":
      return (
        <button
          {...htmxAttrs("end-break")}
          class={buttonClass("bg-yellow-500 hover:bg-yellow-600")}
        >
          休憩終了
        </button>
      );
    
    case "checked_out":
      return (
        <button
          {...htmxAttrs("recheck-in", "再出社でよろしいでしょうか？")}
          class={buttonClass("bg-blue-500 hover:bg-blue-600")}
        >
          再出社
        </button>
      );
    
    case "absent":
      return (
        <p class="text-gray-600 col-span-full">本日は欠勤として記録されています。</p>
      );
    
    default:
      return (
        <p class="text-gray-600">読込中...</p>
      );
  }
};

// ステータス表示用
export const StatusBadge: FC<{ state: UserStateType }> = ({ state }) => {
  const labels: Record<UserStateType, string> = {
    not_checked_in: "未出社",
    checked_in: "出社中",
    on_break: "休憩中",
    checked_out: "退社済み",
    absent: "欠勤",
  };
  
  return (
    <div class="inline-block px-4 py-2 rounded-full bg-blue-100 text-blue-800 font-medium">
      {labels[state] || "不明"}
    </div>
  );
};
