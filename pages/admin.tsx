// pages/admin.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Layout from "../components/Layout";
import { format } from "date-fns";
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
    fetchRecords();
  }, []);

  const handleDownloadCSV = () => {
    window.location.href = `/api/admin/export-csv?startDate=${startDate}&endDate=${endDate}`;
  };

  // 時刻のフォーマット
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    return format(new Date(timeString), "HH:mm:ss");
  };

  // 日付のフォーマット
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "yyyy/MM/dd (E)", { locale: ja });
  };

  return (
    <Layout title="管理者ダッシュボード" requireAuth requireAdmin>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          勤怠管理 - 管理者ダッシュボード
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">勤怠記録</h2>

          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchRecords}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                disabled={loading}
              >
                {loading ? "読込中..." : "表示"}
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleDownloadCSV}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                disabled={loading}
              >
                CSVダウンロード
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                    <tr key={record.id}>
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
                        {record.isAbsent ? "はい" : "いいえ"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
