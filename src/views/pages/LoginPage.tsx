// attendance-deno/src/views/pages/LoginPage.tsx
/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface LoginPageProps {
  error?: string;
  registered?: boolean;
}

export const LoginPage: FC<LoginPageProps> = ({ error, registered }) => {
  return (
    <div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
      <div class="p-8">
        <div class="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-1">
          勤怠管理システム
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-6">ログイン</h1>

        {error && (
          <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}

        {registered && (
          <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
            <p>登録が完了しました。ログインしてください。</p>
          </div>
        )}

        <form action="/api/auth/login" method="post" class="space-y-6">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <button
              type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            >
              ログイン
            </button>
          </div>
        </form>

        <p class="mt-6 text-center text-sm text-gray-600">
          アカウントをお持ちでない場合は
          <a href="/register" class="font-medium text-indigo-600 hover:text-indigo-500 ml-1">
            新規登録
          </a>
        </p>
      </div>
    </div>
  );
};
