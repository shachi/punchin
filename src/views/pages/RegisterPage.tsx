// attendance-deno/src/views/pages/RegisterPage.tsx
/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface RegisterPageProps {
  error?: string;
}

export const RegisterPage: FC<RegisterPageProps> = ({ error }) => {
  return (
    <div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
      <div class="p-8">
        <div class="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-1">
          勤怠管理システム
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-6">新規登録</h1>

        {error && (
          <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}

        <form action="/api/auth/register" method="post" class="space-y-6">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
              名前
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

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
              minlength={6}
              class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            <p class="mt-1 text-xs text-gray-500">6文字以上で入力してください</p>
          </div>

          <div>
            <button
              type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            >
              登録
            </button>
          </div>
        </form>

        <p class="mt-6 text-center text-sm text-gray-600">
          すでにアカウントをお持ちの場合は
          <a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500 ml-1">
            ログイン
          </a>
        </p>
      </div>
    </div>
  );
};
