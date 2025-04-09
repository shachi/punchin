// pages/admin.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ja } from "date-fns/locale";

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  checkOut: string | null;
  isAbsent: boolean;
  totalWorkHours: number | null;
  breakDuration: number | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return format(firstDay, "yyyy-MM-dd");
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    return format(today, "yyyy-MM-dd");
  });

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRecords = async () => {
    setLoading(true);
    setError("");

    try {
      // コンソールでリクエストURLを確認
      const url = `/api/admin/attendance?startDate=${startDate}&endDate=${endDate}`;
      console.log("Fetching records from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        // レスポンスのステータスとテキストをログに出力
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(`勤怠記録の取得に失敗しました (${response.status})`);
      }

      const data = await response.json();

      if (data.success) {
        setRecords(data.records);
      } else {
        setError(data.message || "データの取得に失敗しました");
      }
    } catch (error) {
      console.error("Error fetching records:", error);
      setError(
        error instanceof Error
          ? error.message
          : "勤怠記録の取得中にエラーが発生しました",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 管理者でない場合はダッシュボードにリダイレクト
    if (status !== "loading" && (!session || !session.user?.isAdmin)) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  // 管理者でない場合はレンダリングを中止
  if (!session?.user?.isAdmin) {
    return null;
  }

  const handleDownloadCSV = () => {
    window.location.href = `/api/admin/export-csv?startDate=${startDate}&endDate=${endDate}`;
  };

  // 時刻のフォーマット
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    const date = new Date(timeString);
    const jstDate = toZonedTime(date, "Asia/Tokyo");
    return format(jstDate, "HH:mm:ss");
  };

  // 日付のフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const jstDate = toZonedTime(date, "Asia/Tokyo");
    return format(jstDate, "yyyy/MM/dd (E)", { locale: ja });
  };

  return (
    <Layout title="管理者ダッシュボード" requireAuth requireAdmin>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              勤怠管理 - 管理者ダッシュボード
            </h1>
          </div>

          {error && (
            <div
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"
              role="alert"
            >
              <p>{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-4">勤怠記録</h2>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終了日
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={fetchRecords}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 shadow-sm"
                  disabled={loading}
                >
                  {loading ? "読込中..." : "表示"}
                </button>

                <button
                  onClick={handleDownloadCSV}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 shadow-sm"
                  disabled={loading}
                >
                  CSVダウンロード
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      日付
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      氏名
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      出社時間
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      退社時間
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      休憩時間(分)
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      勤務時間
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      欠勤
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        {loading ? "読込中..." : "記録がありません"}
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.userName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTime(record.checkIn)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTime(record.checkOut)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.breakDuration !== null
                            ? Math.round(record.breakDuration)
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.totalWorkHours !== null
                            ? record.totalWorkHours.toFixed(2)
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.isAbsent ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              はい
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
