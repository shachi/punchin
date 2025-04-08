// components/Header.tsx
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export default function Header() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xl font-bold flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            勤怠管理システム
          </Link>

          {/* モバイルメニューボタン */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white focus:outline-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:block">
            <ul className="flex space-x-6">
              {session ? (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="hover:text-indigo-200 transition duration-150"
                    >
                      ダッシュボード
                    </Link>
                  </li>
                  {session.user?.isAdmin && (
                    <li>
                      <Link
                        href="/admin"
                        className="hover:text-indigo-200 transition duration-150"
                      >
                        管理画面
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      onClick={() => {
                        // 現在の完全なURLを取得（プロキシ後のURLを含む）
                        const currentOrigin = window.location.origin;
                        const loginPath = `${currentOrigin}/login`;

                        // console.log で確認用
                        console.log("現在のオリジン:", currentOrigin);
                        console.log("リダイレクト先:", loginPath);

                        signOut({
                          callbackUrl: loginPath,
                        });
                      }}
                      className="bg-white text-indigo-600 px-4 py-1 rounded-md hover:bg-indigo-50 transition duration-150"
                    >
                      ログアウト
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="hover:text-indigo-200 transition duration-150"
                    >
                      ログイン
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className="bg-white text-indigo-600 px-4 py-1 rounded-md hover:bg-indigo-50 transition duration-150"
                    >
                      新規登録
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="mt-4 md:hidden">
            <ul className="space-y-4">
              {session ? (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="block hover:text-indigo-200 transition duration-150"
                    >
                      ダッシュボード
                    </Link>
                  </li>
                  {session.user?.isAdmin && (
                    <li>
                      <Link
                        href="/admin"
                        className="block hover:text-indigo-200 transition duration-150"
                      >
                        管理画面
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition duration-150"
                    >
                      ログアウト
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="block hover:text-indigo-200 transition duration-150"
                    >
                      ログイン
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className="block bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition duration-150"
                    >
                      新規登録
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
