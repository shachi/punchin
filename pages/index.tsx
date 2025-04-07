// pages/index.tsx
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Layout from "../components/Layout";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ログイン済みユーザーはダッシュボードにリダイレクト
  useEffect(() => {
    if (session) {
      if (session.user?.isAdmin) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [session, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <Layout title="勤怠管理システム - ホーム">
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-6">勤怠管理システム</h1>
          <p className="text-xl mb-8">
            シンプルで使いやすい勤怠管理システムへようこそ。
            出勤、退勤、休憩時間を簡単に記録できます。
          </p>

          {!session ? (
            <div className="space-x-4">
              <Link
                href="/login"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
              >
                ログイン
              </Link>
              <Link
                href="/register"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded"
              >
                新規登録
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
