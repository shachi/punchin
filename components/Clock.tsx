// components/Clock.tsx
import { useState, useEffect } from "react";

export default function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // 曜日の配列
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  // 日付のフォーマット
  const dateString = `${time.getFullYear()}年${time.getMonth() + 1}月${time.getDate()}日(${weekdays[time.getDay()]})`;

  // 時刻のフォーマット
  const hours = String(time.getHours()).padStart(2, "0");
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = String(time.getSeconds()).padStart(2, "0");

  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-mono font-bold mb-2 text-indigo-800 tracking-wider">
        {hours}
        <span className="animate-pulse">:</span>
        {minutes}
        <span className="animate-pulse">:</span>
        {seconds}
      </div>
      <div className="text-xl text-gray-600">{dateString}</div>
    </div>
  );
}
