// components/AttendanceButtons.tsx
import { useState } from "react";

interface AttendanceButtonsProps {
  currentState: string;
  onStateChange: (newState: string, message: string) => void;
  onError: (message: string) => void;
}

export default function AttendanceButtons({
  currentState,
  onStateChange,
  onError,
}: AttendanceButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAttendanceAction = async (action: string) => {
    if (isLoading) return;

    // 欠勤の場合は確認
    if (action === "absent" && !confirm("本日を欠勤として記録しますか？")) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        onStateChange(data.currentState, data.message);
      } else {
        onError(data.message || "処理に失敗しました");
      }
    } catch (error) {
      onError("エラーが発生しました");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">勤怠登録</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 出社ボタン */}
        {(currentState === "not_checked_in" || currentState === "loading") && (
          <button
            onClick={() => handleAttendanceAction("check-in")}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "出社"}
          </button>
        )}

        {/* 休憩開始ボタン */}
        {currentState === "checked_in" && (
          <button
            onClick={() => handleAttendanceAction("start-break")}
            disabled={isLoading}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "休憩開始"}
          </button>
        )}

        {/* 休憩終了ボタン */}
        {currentState === "on_break" && (
          <button
            onClick={() => handleAttendanceAction("end-break")}
            disabled={isLoading}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "休憩終了"}
          </button>
        )}

        {/* 退社ボタン */}
        {currentState === "checked_in" && (
          <button
            onClick={() => handleAttendanceAction("check-out")}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "退社"}
          </button>
        )}

        {/* 欠勤ボタン */}
        {currentState === "not_checked_in" && (
          <button
            onClick={() => handleAttendanceAction("absent")}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "欠勤"}
          </button>
        )}
      </div>
    </div>
  );
}
