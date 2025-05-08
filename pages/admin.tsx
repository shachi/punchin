// pages/admin.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import dayjs from "../lib/dayjs";

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

  // 現在の年月 - 日本時間ベース
  const [currentMonth, setCurrentMonth] = useState(() => {
    return dayjs().tz("Asia/Tokyo").toDate();
  });

  // 選択された期間の開始日・終了日
  const [startDate, setStartDate] = useState<string>(() => {
    const firstDay = dayjs(currentMonth).tz("Asia/Tokyo").startOf("month");
    return firstDay.format("YYYY-MM-DD");
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const lastDay = dayjs(currentMonth).tz("Asia/Tokyo").endOf("month");
    return lastDay.format("YYYY-MM-DD");
  });

  // 既存の状態変数
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ページング用の状態を追加
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // 月が変更されたら日付範囲を更新 - 日本時間ベース
  useEffect(() => {
    try {
      const firstDay = dayjs(currentMonth).tz("Asia/Tokyo").startOf("month");
      const lastDay = dayjs(currentMonth).tz("Asia/Tokyo").endOf("month");
      console.log("月の初日 (JST):", firstDay.format("YYYY-MM-DD"));
      console.log("月の最終日 (JST):", lastDay.format("YYYY-MM-DD"));
      setStartDate(firstDay.format("YYYY-MM-DD"));
      setEndDate(lastDay.format("YYYY-MM-DD"));
      setCurrentPage(1); // 月が変わったら1ページ目に戻す
    } catch (error) {
      console.error("Date format error:", error);
      // エラー時はデフォルト値を設定
      const now = dayjs().tz("Asia/Tokyo");
      setStartDate(now.startOf("month").format("YYYY-MM-DD"));
      setEndDate(now.endOf("month").format("YYYY-MM-DD"));
    }
  }, [currentMonth]);

  // 前月へ - 日本時間ベース
  const goToPreviousMonth = () => {
    setCurrentMonth((prevMonth) =>
      dayjs(prevMonth).tz("Asia/Tokyo").subtract(1, "month").toDate(),
    );
  };

  // 翌月へ - 日本時間ベース
  const goToNextMonth = () => {
    setCurrentMonth((prevMonth) =>
      dayjs(prevMonth).tz("Asia/Tokyo").add(1, "month").toDate(),
    );
  };

  // 記録取得
  const fetchRecords = async (page = currentPage) => {
    setLoading(true);
    setError("");

    try {
      // URLにページングパラメータを追加
      const url = `/api/admin/attendance?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`;
      console.log("日本時間での検索範囲:", startDate, "から", endDate);
      console.log("Fetching records from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(`勤怠記録の取得に失敗しました (${response.status})`);
      }

      const data = await response.json();
      console.log("API response status:", data.success);
      console.log(`Received ${data.records?.length || 0} records`);

      if (data.success) {
        setRecords(data.records);

        // ページング情報を更新
        if (data.pagination) {
          setCurrentPage(data.pagination.currentPage);
          setTotalPages(data.pagination.totalPages);
          setTotal(data.pagination.total);
        }
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

  // 時刻のフォーマット - 日本時間ベース
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    try {
      return dayjs(timeString).tz("Asia/Tokyo").format("HH:mm:ss");
    } catch (error) {
      console.error("Time format error:", error, timeString);
      return "-";
    }
  };

  // 日付のフォーマット - 日本時間ベース
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return dayjs(dateString).tz("Asia/Tokyo").format("YYYY/MM/DD (ddd)");
    } catch (error) {
      console.error("Date format error:", error, dateString);
      return "-";
    }
  };

  // 表示時のフォーマット - 日本時間ベース
  const monthDisplay = dayjs(currentMonth).tz("Asia/Tokyo").format("YYYY年M月");

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchRecords(newPage);
    }
  };

  // 日付範囲が変更されたら記録を取得
  useEffect(() => {
    if (session?.user?.isAdmin) {
      fetchRecords(1);
    }
  }, [startDate, endDate, session]);

  // ページネーションコンポーネント
  const Pagination = () => {
    const pageButtons = [];

    // 表示するページボタンの範囲を決定
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    // 最初のページへのボタン
    if (startPage > 1) {
      pageButtons.push(
        <button
          key="first"
          onClick={() => handlePageChange(1)}
          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
        >
          最初
        </button>,
      );
    }
    // ページ番号ボタン
    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 border rounded mx-1 ${
            i === currentPage
              ? "bg-blue-500 text-white"
              : "border-gray-300 hover:bg-gray-100"
          }`}
        >
          {i}
        </button>,
      );
    }
    // 最後のページへのボタン
    if (endPage < totalPages) {
      pageButtons.push(
        <button
          key="last"
          onClick={() => handlePageChange(totalPages)}
          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
        >
          最後
        </button>,
      );
    }
    return (
      <div className="flex items-center justify-center mt-4 space-x-2">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-3 py-1 border rounded ${
            currentPage === 1
              ? "text-gray-400 border-gray-200 cursor-not-allowed"
              : "border-gray-300 hover:bg-gray-100"
          }`}
        >
          前へ
        </button>

        {pageButtons}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-3 py-1 border rounded ${
            currentPage === totalPages
              ? "text-gray-400 border-gray-200 cursor-not-allowed"
              : "border-gray-300 hover:bg-gray-100"
          }`}
        >
          次へ
        </button>
      </div>
    );
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

  // CSV出力用
  const handleDownloadCSV = () => {
    window.location.href = `/api/admin/export-csv?startDate=${startDate}&endDate=${endDate}`;
  };

  // CSVエクスポート（月単位）
  const handleExportMonthlyCSV = () => {
    window.location.href = `/api/admin/export-csv?startDate=${startDate}&endDate=${endDate}&type=monthly`;
  };

  return (
    <Layout title="管理者ダッシュボード" requireAuth requireAdmin>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            勤怠管理 - 管理者ダッシュボード
          </h1>
          {/* 月選択UI */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <button
                onClick={goToPreviousMonth}
                className="text-blue-600 hover:text-blue-800"
              >
                ← 前月
              </button>

              <h2 className="text-xl font-semibold">{monthDisplay}</h2>

              <button
                onClick={goToNextMonth}
                className="text-blue-600 hover:text-blue-800"
              >
                翌月 →
              </button>
            </div>
          </div>
          <div className="flex justify-between mb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(currentPage)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
              >
                表示更新
              </button>

              <button
                onClick={handleExportMonthlyCSV}
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                月次CSVエクスポート
              </button>

              {/* 時刻修正申請ページへのリンクボタン */}
              <button
                onClick={() => router.push("/admin/edit-requests")}
                className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                時刻修正申請
              </button>
            </div>
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
                  onClick={() => handlePageChange(currentPage)}
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
      {/* テーブルの後にページネーションを追加 */}
      <div className="mt-4">
        {records.length > 0 && (
          <div className="mt-2 text-sm text-gray-500 text-center">
            全{total}件中 {(currentPage - 1) * pageSize + 1}～
            {Math.min(currentPage * pageSize, total)}件を表示
          </div>
        )}
        {totalPages > 1 && <Pagination />}
      </div>
    </Layout>
  );
}
