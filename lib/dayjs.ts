import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/ja"; // 日本語ロケール

// プラグインを使用
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

// デフォルトロケールを日本語に設定
dayjs.locale("ja");

// デフォルトタイムゾーンを設定
dayjs.tz.setDefault("Asia/Tokyo");

export default dayjs;
