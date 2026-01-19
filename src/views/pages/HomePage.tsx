// attendance-deno/src/views/pages/HomePage.tsx
/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

export const HomePage: FC = () => {
  return (
    <div class="min-h-[60vh] flex flex-col items-center justify-center">
      <div class="text-center max-w-2xl mx-auto">
        <h1 class="text-4xl font-bold mb-6 text-gray-800">勤怠管理システム</h1>
        <p class="text-xl mb-8 text-gray-600">
          シンプルで使いやすい勤怠管理システムへようこそ。
          出勤、退勤、休憩時間を簡単に記録できます。
        </p>

        <div class="space-x-4">
          <a
            href="/login"
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded inline-block"
          >
            ログイン
          </a>
          <a
            href="/register"
            class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded inline-block"
          >
            新規登録
          </a>
        </div>
      </div>
    </div>
  );
};
