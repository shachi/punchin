// components/Header.tsx
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          勤怠管理システム
        </Link>

        <nav>
          <ul className="flex space-x-4">
            {session ? (
              <>
                <li>
                  <Link href="/dashboard" className="hover:underline">
                    ダッシュボード
                  </Link>
                </li>
                {session.user.isAdmin && (
                  <li>
                    <Link href="/admin" className="hover:underline">
                      管理画面
                    </Link>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="hover:underline"
                  >
                    ログアウト
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className="hover:underline">
                    ログイン
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:underline">
                    新規登録
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
