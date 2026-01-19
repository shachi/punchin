// attendance-deno/src/views/Layout.tsx
import type { FC } from "hono/jsx";
import type { SessionUser } from "../types.ts";

interface LayoutProps {
  title?: string;
  user?: SessionUser | null;
  children: unknown;
}

export const Layout: FC<LayoutProps> = ({
  title = "勤怠管理システム",
  user,
  children,
}) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://unpkg.com/htmx.org@2.0.0"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          .htmx-indicator { display: none; }
          .htmx-request .htmx-indicator { display: inline; }
          .htmx-request.htmx-indicator { display: inline; }
        `}</style>
      </head>
      <body class="bg-gray-100 min-h-screen flex flex-col">
        <Header user={user} />
        <main class="flex-grow container mx-auto px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
};

const Header: FC<{ user?: SessionUser | null }> = ({ user }) => {
  return (
    <header class="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md">
      <div class="container mx-auto px-4 py-4">
        <div class="flex justify-between items-center">
          <a href="/" class="text-xl font-bold flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            勤怠管理システム
          </a>

          <nav>
            <ul class="flex space-x-6">
              {user ? (
                <>
                  <li>
                    <a
                      href="/dashboard"
                      class="hover:text-indigo-200 transition duration-150"
                    >
                      ダッシュボード
                    </a>
                  </li>
                  {user.isAdmin ? (
                    <li>
                      <a
                        href="/admin"
                        class="hover:text-indigo-200 transition duration-150"
                      >
                        管理画面
                      </a>
                    </li>
                  ) : null}
                  <li>
                    <form
                      action="/api/auth/logout"
                      method="POST"
                      class="inline"
                    >
                      <button
                        type="submit"
                        class="bg-white text-indigo-600 px-4 py-1 rounded-md hover:bg-indigo-50 transition duration-150"
                      >
                        ログアウト
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <a
                      href="/login"
                      class="hover:text-indigo-200 transition duration-150"
                    >
                      ログイン
                    </a>
                  </li>
                  <li>
                    <a
                      href="/register"
                      class="bg-white text-indigo-600 px-4 py-1 rounded-md hover:bg-indigo-50 transition duration-150"
                    >
                      新規登録
                    </a>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
};

const Footer: FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer class="bg-white py-4 shadow-inner">
      <div class="container mx-auto px-4 text-center text-gray-600 text-sm">
        <p>© {year} 勤怠管理システム</p>
      </div>
    </footer>
  );
};
