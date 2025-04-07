// pages/dashboard.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Layout from "../components/Layout";
import AttendanceButtons from "../components/AttendanceButtons";
import Clock from "../components/Clock";

// 型定義
interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  checkOut: string | null;
  isAbsent: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [userState, setUserState] = useState("loading");
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  // ユーザーの勤怠状態を取得
  const fetchUserState = async () => {
    try {
      const response = await fetch("/api/attendance/state");
      if (!response.ok) {
        throw new Error("状態の取得に失敗しました");
      }

      const data = await response.json();
      if (data.success) {
        setUserState(data.currentState || "not_checked_in");
        setRecord(data.record);
      } else {
        setMessage({ text: data.message, type: "error" });
      }
    } catch (error) {
      setMessage({ text: "エラーが発生しました", type: "error" });
      console.error(error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchUserState();
    }
  }, [session]);

  // 勤怠ステータスを表示するためのヘルパー関数
  const getStatusText = (state: string) => {
    switch (state) {
      case "not_checked_in":
        return "未出社";
      case "checked_in":
        return "出社中";
      case "on_break":
        return "休憩中";
      case "checked_out":
        return "退社済み";
      case "absent":
        return "欠勤";
      case "loading":
        return "読込中...";
      default:
        return "不明";
    }
  };

  // デバッグ表示
  console.log("Current state:", userState);

  return (
    <Layout title="ダッシュボード" requireAuth>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            勤怠管理ダッシュボード
          </h1>

          {message.text && (
            <div
              className={`mb-6 p-4 rounded-md ${message.type === "success" ? "bg-green-100 text-green-800 border-l-4 border-green-500" : "bg-red-100 text-red-800 border-l-4 border-red-500"}`}
            >
              {message.text}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
            <Clock />

            <div className="my-6">
              <h2 className="text-lg font-medium text-gray-700 mb-2">
                現在の状態
              </h2>
              <div className="inline-block px-4 py-2 rounded-full bg-blue-100 text-blue-800 font-medium">
                {getStatusText(userState)}
              </div>
            </div>
          </div>

          {/* ここでコンポーネントが表示されているか確認 */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-4">勤怠登録</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 出社ボタン */}
              {(userState === "not_checked_in" || userState === "loading") && (
                <button
                  onClick={() => {
                    fetch("/api/attendance/check-in", { method: "POST" })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success) {
                          setUserState(data.currentState);
                          setMessage({ text: data.message, type: "success" });
                          fetchUserState();
                        } else {
                          setMessage({
                            text: data.message || "処理に失敗しました",
                            type: "error",
                          });
                        }
                      })
                      .catch((err) => {
                        console.error(err);
                        setMessage({
                          text: "エラーが発生しました",
                          type: "error",
                        });
                      });
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded"
                >
                  出社
                </button>
              )}

              {/* 休憩開始ボタン */}
              {userState === "checked_in" && (
                <button
                  onClick={() => {
                    fetch("/api/attendance/start-break", { method: "POST" })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success) {
                          setUserState(data.currentState);
                          setMessage({ text: data.message, type: "success" });
                          fetchUserState();
                        } else {
                          setMessage({
                            text: data.message || "処理に失敗しました",
                            type: "error",
                          });
                        }
                      })
                      .catch((err) => {
                        console.error(err);
                        setMessage({
                          text: "エラーが発生しました",
                          type: "error",
                        });
                      });
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm"
                >
                  休憩開始
                </button>
              )}

              {/* 休憩終了ボタン */}
              {userState === "on_break" && (
                <button
                  onClick={() => {
                    fetch("/api/attendance/end-break", { method: "POST" })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success) {
                          setUserState(data.currentState);
                          setMessage({ text: data.message, type: "success" });
                          fetchUserState();
                        } else {
                          setMessage({
                            text: data.message || "処理に失敗しました",
                            type: "error",
                          });
                        }
                      })
                      .catch((err) => {
                        console.error(err);
                        setMessage({
                          text: "エラーが発生しました",
                          type: "error",
                        });
                      });
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm"
                >
                  休憩終了
                </button>
              )}

              {/* 退社ボタン */}
              {userState === "checked_in" && (
                <button
                  onClick={() => {
                    fetch("/api/attendance/check-out", { method: "POST" })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success) {
                          setUserState(data.currentState);
                          setMessage({ text: data.message, type: "success" });
                          fetchUserState();
                        } else {
                          setMessage({
                            text: data.message || "処理に失敗しました",
                            type: "error",
                          });
                        }
                      })
                      .catch((err) => {
                        console.error(err);
                        setMessage({
                          text: "エラーが発生しました",
                          type: "error",
                        });
                      });
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm"
                >
                  退社
                </button>
              )}

              {/* 欠勤ボタン */}
              {userState === "not_checked_in" && (
                <button
                  onClick={() => {
                    if (confirm("本日を欠勤として記録しますか？")) {
                      fetch("/api/attendance/absent", { method: "POST" })
                        .then((res) => res.json())
                        .then((data) => {
                          if (data.success) {
                            setUserState(data.currentState);
                            setMessage({ text: data.message, type: "success" });
                            fetchUserState();
                          } else {
                            setMessage({
                              text: data.message || "処理に失敗しました",
                              type: "error",
                            });
                          }
                        })
                        .catch((err) => {
                          console.error(err);
                          setMessage({
                            text: "エラーが発生しました",
                            type: "error",
                          });
                        });
                    }
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm"
                >
                  欠勤
                </button>
              )}
            </div>
          </div>

          {record && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-700 mb-4">
                今日の記録
              </h2>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-1/3">
                      出社時間
                    </th>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {record.checkIn
                        ? new Date(record.checkIn).toLocaleTimeString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                      休憩開始
                    </th>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {record.breakStart
                        ? new Date(record.breakStart).toLocaleTimeString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                      休憩終了
                    </th>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {record.breakEnd
                        ? new Date(record.breakEnd).toLocaleTimeString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                      退社時間
                    </th>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {record.checkOut
                        ? new Date(record.checkOut).toLocaleTimeString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                      欠勤
                    </th>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {record.isAbsent ? "はい" : "いいえ"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
