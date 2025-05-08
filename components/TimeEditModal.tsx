// components/TimeEditModal.tsx
import { useState } from "react";
import dayjs from "../lib/dayjs";

interface TimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string;
  checkIn: string | null;
  checkOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  onSubmitSuccess: () => void;
}

export default function TimeEditModal({
  isOpen,
  onClose,
  recordId,
  checkIn,
  checkOut,
  breakStart,
  breakEnd,
  onSubmitSuccess,
}: TimeEditModalProps) {
  // 各打刻時間の状態
  const [editCheckIn, setEditCheckIn] = useState(
    checkIn ? dayjs(checkIn).tz("Asia/Tokyo").format("HH:mm") : "",
  );
  const [editCheckOut, setEditCheckOut] = useState(
    checkOut ? dayjs(checkOut).tz("Asia/Tokyo").format("HH:mm") : "",
  );
  const [editBreakStart, setEditBreakStart] = useState(
    breakStart ? dayjs(breakStart).tz("Asia/Tokyo").format("HH:mm") : "",
  );
  const [editBreakEnd, setEditBreakEnd] = useState(
    breakEnd ? dayjs(breakEnd).tz("Asia/Tokyo").format("HH:mm") : "",
  );

  // 理由の状態
  const [reason, setReason] = useState("");

  // 修正対象のフィールド
  const [editField, setEditField] = useState<string | null>(null);

  // 送信中状態
  const [isSubmitting, setIsSubmitting] = useState(false);

  // エラーメッセージ
  const [error, setError] = useState("");

  // 修正送信処理
  const handleSubmit = async () => {
    // バリデーション
    if (!editField) {
      setError("修正したい項目を選択してください");
      return;
    }

    if (!reason) {
      setError("修正理由を入力してください");
      return;
    }

    let newValue = "";
    let oldValue = null;

    switch (editField) {
      case "checkIn":
        newValue = editCheckIn;
        oldValue = checkIn;
        break;
      case "checkOut":
        newValue = editCheckOut;
        oldValue = checkOut;
        break;
      case "breakStart":
        newValue = editBreakStart;
        oldValue = breakStart;
        break;
      case "breakEnd":
        newValue = editBreakEnd;
        oldValue = breakEnd;
        break;
    }

    if (!newValue) {
      setError("新しい時間を入力してください");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // 現在の日付を取得（日本時間）
      const today = dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD");

      // 時刻を日付と結合して完全な日時にする（明示的に日本時間として指定）
      // この部分が重要です - タイムゾーンを明示的に指定
      const fullDateTime = dayjs
        .tz(`${today} ${newValue}:00`, "YYYY-MM-DD HH:mm:ss", "Asia/Tokyo")
        .format();

      const response = await fetch("/api/attendance/edit-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId,
          field: editField,
          newValue: fullDateTime,
          reason,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSubmitSuccess();
        onClose();
      } else {
        setError(data.message || "申請の送信に失敗しました");
      }
    } catch (err) {
      console.error("Error submitting edit request:", err);
      setError("申請の送信中にエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">打刻時間修正申請</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">修正したい項目</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditField("checkIn")}
              className={`p-2 rounded border ${
                editField === "checkIn"
                  ? "bg-blue-100 border-blue-500"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              出社時間
            </button>
            <button
              type="button"
              onClick={() => setEditField("checkOut")}
              className={`p-2 rounded border ${
                editField === "checkOut"
                  ? "bg-blue-100 border-blue-500"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              退社時間
            </button>
            <button
              type="button"
              onClick={() => setEditField("breakStart")}
              className={`p-2 rounded border ${
                editField === "breakStart"
                  ? "bg-blue-100 border-blue-500"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              休憩開始時間
            </button>
            <button
              type="button"
              onClick={() => setEditField("breakEnd")}
              className={`p-2 rounded border ${
                editField === "breakEnd"
                  ? "bg-blue-100 border-blue-500"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              休憩終了時間
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">現在の時間</label>
              <div className="p-2 bg-gray-100 rounded">
                {editField === "checkIn" &&
                  (checkIn
                    ? dayjs(checkIn).tz("Asia/Tokyo").format("HH:mm")
                    : "-")}
                {editField === "checkOut" &&
                  (checkOut
                    ? dayjs(checkOut).tz("Asia/Tokyo").format("HH:mm")
                    : "-")}
                {editField === "breakStart" &&
                  (breakStart
                    ? dayjs(breakStart).tz("Asia/Tokyo").format("HH:mm")
                    : "-")}
                {editField === "breakEnd" &&
                  (breakEnd
                    ? dayjs(breakEnd).tz("Asia/Tokyo").format("HH:mm")
                    : "-")}
                {!editField && "-"}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                新しい時間 (JST)
              </label>
              <input
                type="time"
                value={
                  editField === "checkIn"
                    ? editCheckIn
                    : editField === "checkOut"
                      ? editCheckOut
                      : editField === "breakStart"
                        ? editBreakStart
                        : editField === "breakEnd"
                          ? editBreakEnd
                          : ""
                }
                onChange={(e) => {
                  if (editField === "checkIn") setEditCheckIn(e.target.value);
                  else if (editField === "checkOut")
                    setEditCheckOut(e.target.value);
                  else if (editField === "breakStart")
                    setEditBreakStart(e.target.value);
                  else if (editField === "breakEnd")
                    setEditBreakEnd(e.target.value);
                }}
                className="w-full border rounded py-2 px-3"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">修正理由</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded py-2 px-3"
            rows={3}
            placeholder="修正理由を入力してください"
          ></textarea>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            disabled={isSubmitting}
          >
            {isSubmitting ? "送信中..." : "申請する"}
          </button>
        </div>
      </div>
    </div>
  );
}
