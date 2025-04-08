// pages/dashboard.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
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
  const router = useRouter();
  const { data: session, status } = useSession();
  const [userState, setUserState] = useState("loading");
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  // セッション状態に基づくリダイレクト処理
  useEffect(() => {
    if (status === "loading") {
      return; // セッション読み込み中は何もしない
    }

    if (status === "unauthenticated") {
      router.push("/login"); // 認証されていない場合はログインページへ
    }
  }, [status, router]);
  // 状態取得を強化
  const fetchUserState = async () => {
    try {
      console.log("Fetching user state...");
      const response = await fetch("/api/attendance/state");

      if (!response.ok) {
        throw new Error("状態の取得に失敗しました");
      }

      const data = await response.json();
      console.log("State API response:", data);

      if (data.success) {
        // 状態を更新
        setUserState(data.currentState || "not_checked_in");
        setRecord(data.record);

        // 日付変更の通知
        if (data.dateChanged) {
          setMessage({
            text: "業務日が変わりました。新しい日の勤怠を記録できます。",
            type: "info",
          });
        }
      } else {
        setMessage({
          text: data.message || "状態の取得に失敗しました",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error fetching state:", error);
      setMessage({ text: "エラーが発生しました", type: "error" });
    }
  };

  // 出社ボタンクリック時の処理
  const handleCheckIn = async () => {
    try {
      console.log("Checking in...");
      setMessage({ text: "処理中...", type: "info" });

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
      });

      const data = await response.json();
      console.log("Check-in API response:", data);

      if (data.success) {
        setUserState(data.currentState || "checked_in");
        setMessage({ text: data.message || "出社しました", type: "success" });
        fetchUserState(); // 最新の状態を取得
      } else {
        // エラーの場合も状態を更新（APIからの返送値があれば）
        if (data.currentState) {
          setUserState(data.currentState);
        }
        setMessage({
          text: data.message || "処理に失敗しました",
          type: "error",
        });
        fetchUserState(); // 最新の状態を取得
      }
    } catch (error) {
      console.error("Error checking in:", error);
      setMessage({ text: "エラーが発生しました", type: "error" });
    }
  };

  // 日付変更の検出用タイマー
  useEffect(() => {
    if (session) {
      // 初回読み込み時に状態取得
      fetchUserState();

      // ページがフォーカスを取得したときに状態を更新
      const handleFocus = () => {
        console.log("Window focused, updating state");
        fetchUserState();
      };

      // ページが表示状態になったときに状態を更新
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          console.log("Page became visible, updating state");
          fetchUserState();
        }
      };

      // 1分ごとにチェック（特にAM4時周辺）
      const timer = setInterval(() => {
        const now = new Date();
        console.log("Regular check:", now.toLocaleTimeString());

        // AM4:00ちょうどに近い場合は強制リロード
        if (now.getHours() === 4 && now.getMinutes() === 0) {
          console.log("It's 4:00 AM, reloading page");
          window.location.reload();
          return;
        }

        // それ以外は通常の更新
        fetchUserState();
      }, 60000);

      // イベントリスナーを登録
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        clearInterval(timer);
      };
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
              className={`mb-6 p-4 rounded-md ${
                message.type === "success"
                  ? "bg-green-100 text-green-800 border-l-4 border-green-500"
                  : message.type === "error"
                    ? "bg-red-100 text-red-800 border-l-4 border-red-500"
                    : "bg-blue-100 text-blue-800 border-l-4 border-blue-500"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
            <Clock />

            <div className="my-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-medium text-gray-700">
                  現在の状態
                </h2>
                <button
                  onClick={() => {
                    setMessage({
                      text: "状態を更新しています...",
                      type: "info",
                    });
                    fetchUserState();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  更新
                </button>
              </div>
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
              {userState === "not_checked_in" && (
                <button
                  onClick={handleCheckIn}
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
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm"
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
                  className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm"
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
