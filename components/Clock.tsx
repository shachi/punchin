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
  const timeString = time.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="text-center">
      <div className="text-5xl font-bold mb-2">{timeString}</div>
      <div className="text-xl text-gray-600">{dateString}</div>
    </div>
  );
}
