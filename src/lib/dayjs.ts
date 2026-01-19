// attendance-deno/src/lib/dayjs.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/ja";

// プラグインを使用
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// 日本語ロケール設定
dayjs.locale("ja");

// デフォルトのタイムゾーンを設定
dayjs.tz.setDefault("Asia/Tokyo");

export default dayjs;

// 業務日を計算する関数（AM4時を境界とする）
export function getBusinessDate(date?: dayjs.Dayjs): dayjs.Dayjs {
  const now = date || dayjs().tz("Asia/Tokyo");
  return now.hour() < 4
    ? now.subtract(1, "day").startOf("day")
    : now.startOf("day");
}

// 業務日の範囲を取得
export function getBusinessDayRange(date?: dayjs.Dayjs): { start: Date; end: Date } {
  const businessDate = getBusinessDate(date);
  const start = businessDate.toDate();
  const end = businessDate
    .add(1, "day")
    .hour(3)
    .minute(59)
    .second(59)
    .millisecond(999)
    .toDate();
  return { start, end };
}
