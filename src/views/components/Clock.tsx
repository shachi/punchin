// attendance-deno/src/views/components/Clock.tsx
import type { FC } from "hono/jsx";

// サーバーサイドで初期値を生成し、クライアントサイドJSで更新
export const Clock: FC = () => {
  const clockScript = `
    (function() {
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

      function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const timeEl = document.getElementById('clock-time');
        if (timeEl) {
          timeEl.innerHTML = hours + '<span class="animate-pulse">:</span>' +
            minutes + '<span class="animate-pulse">:</span>' + seconds;
        }

        const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' +
          now.getDate() + '日(' + weekdays[now.getDay()] + ')';
        const dateEl = document.getElementById('clock-date');
        if (dateEl) {
          dateEl.textContent = dateStr;
        }
      }

      updateClock();
      setInterval(updateClock, 1000);
    })();
  `;

  return (
    <div class="text-center" id="clock-container">
      <div
        id="clock-time"
        class="text-4xl md:text-5xl font-mono font-bold mb-2 text-indigo-800 tracking-wider"
      >
        --:--:--
      </div>
      <div id="clock-date" class="text-xl text-gray-600">
        読込中...
      </div>
      <script dangerouslySetInnerHTML={{ __html: clockScript }} />
    </div>
  );
};
