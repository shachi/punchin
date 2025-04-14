// pages/dashboard.tsx
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dayjs from "../lib/dayjs";
import Layout from "../components/Layout";
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
  const [isLoading, setIsLoading] = useState(false);
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

  // 状態取得を強化 - useCallbackで関数を安定化
  const fetchUserState = useCallback(
    async (retryCount = 0) => {
      try {
        setIsLoading(true);
        console.log("Fetching user state...");
        try {
          const response = await fetch("/api/attendance/state");

          if (!response.ok) {
            // エラーレスポンスの内容を確認
            const errorText = await response.text();
            console.error("API error response:", errorText);

            // 一時的なエラー（502, 503, 504）の場合はリトライ
            if ([502, 503, 504].includes(response.status) && retryCount < 3) {
              console.log(
                `一時的なエラーが発生しました(${response.status})。再試行します(${retryCount + 1}/3)...`,
              );

              // 少し待ってからリトライ
              await new Promise((resolve) => setTimeout(resolve, 2000));
              return fetchUserState(retryCount + 1);
            }
            throw new Error(`状態の取得に失敗しました - ${response.status}`);
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
            // エラーメッセージがあれば削除
            if (message.type === "error") {
              setMessage({ text: "", type: "" });
            }
          } else {
            setMessage({
              text: data.message || "状態の取得に失敗しました",
              type: "error",
            });
          }
        } catch (error) {
          console.error("Error fetching state:", error);

          // リトライロジック
          if (retryCount < 3) {
            console.log(
              `エラーが発生しました。再試行します(${retryCount + 1}/3)...`,
            );
            setMessage({
              text: `状態の取得中にエラーが発生しました。再試行中...(${retryCount + 1}/3)`,
              type: "warning",
            });

            // 少し待ってからリトライ
            setTimeout(
              () => fetchUserState(retryCount + 1),
              3000 * (retryCount + 1),
            );
          } else {
            setMessage({
              text: "状態の取得に失敗しました。ページを更新してください。",
              type: "error",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user status:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [message.type],
  );

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
      // 1分ごとにチェック
      const timer = setInterval(() => {
        const now = dayjs().tz("Asia/Tokyo");
        console.log("Regular check:", now.format("HH:mm:ss"));

        // AM4:00ちょうどに近い場合は強制リロード
        if (now.hour() === 4 && now.minute() >= 0 && now.minute() < 5) {
          console.log("It's around 4:00 AM JST, reloading page");
          window.location.reload();
          return;
        }

        // 状態更新
        fetchUserState();
      }, 60000);

      return () => clearInterval(timer);
    }
  }, [session, fetchUserState]);

  // コンポーネントマウント時に状態を取得
  useEffect(() => {
    if (session) {
      fetchUserState();
    }
  }, [session, fetchUserState]);

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
                    : message.type === "warning"
                      ? "bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500"
                      : "bg-blue-100 text-blue-800 border-l-4 border-blue-500"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {message.type === "success" && (
                    <svg
                      className="h-5 w-5 mr-2 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {message.type === "error" && (
                    <svg
                      className="h-5 w-5 mr-2 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                  {message.type === "warning" && (
                    <svg
                      className="h-5 w-5 mr-2 text-yellow-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  )}
                  {message.type === "info" && (
                    <svg
                      className="h-5 w-5 mr-2 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  {message.text}
                </div>

                {message.type === "error" && (
                  <button
                    onClick={() => {
                      setMessage({
                        text: "接続を試みています...",
                        type: "info",
                      });
                      fetchUserState(0);
                    }}
                    className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    再接続
                  </button>
                )}
              </div>
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
                  disabled={isLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "出社"}
                </button>
              )}

              {/* 休憩開始ボタン */}
              {userState === "checked_in" && (
                <button
                  onClick={() => {
                    setIsLoading(true);
                    setMessage({ text: "処理中...", type: "info" });
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
                      })
                      .finally(() => {
                        setIsLoading(false);
                      });
                  }}
                  disabled={isLoading}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "休憩開始"}
                </button>
              )}

              {/* 休憩終了ボタン */}
              {userState === "on_break" && (
                <button
                  onClick={() => {
                    setIsLoading(true);
                    setMessage({ text: "処理中...", type: "info" });
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
                      })
                      .finally(() => {
                        setIsLoading(false);
                      });
                  }}
                  disabled={isLoading}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "休憩終了"}
                </button>
              )}

              {/* 退社ボタン */}
              {userState === "checked_in" && (
                <button
                  onClick={() => {
                    // 確認ダイアログを表示
                    if (confirm("本当に今日の業務終了でよろしいでしょうか？")) {
                      setIsLoading(true);
                      setMessage({ text: "処理中...", type: "info" });
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
                        })
                        .finally(() => {
                          setIsLoading(false);
                        });
                    }
                  }}
                  disabled={isLoading}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "退社"}
                </button>
              )}
              {/* 再出社ボタン */}
              {userState === "checked_out" && (
                <button
                  onClick={() => {
                    // 確認ダイアログを表示
                    if (confirm("再出社でよろしいでしょうか？")) {
                      setIsLoading(true);
                      setMessage({ text: "処理中...", type: "info" });
                      fetch("/api/attendance/recheck-in", { method: "POST" })
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
                        })
                        .finally(() => {
                          setIsLoading(false);
                        });
                    }
                  }}
                  disabled={isLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "再出社"}
                </button>
              )}

              {/* 欠勤ボタン */}
              {userState === "not_checked_in" && (
                <button
                  onClick={() => {
                    if (confirm("本日を欠勤として記録しますか？")) {
                      setIsLoading(true);
                      setMessage({ text: "処理中...", type: "info" });
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
                        })
                        .finally(() => {
                          setIsLoading(false);
                        });
                    }
                  }}
                  disabled={isLoading}
                  className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-md transition duration-150 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? "処理中..." : "欠勤"}
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
