// attendance-deno/src/lib/excel.ts
// 月次勤怠Excelレポート生成（先方提出フォーマット準拠）
import ExcelJS from "exceljs";
import { getDb } from "../db/client.ts";
import dayjs from "./dayjs.ts";
import type { AttendanceRecord } from "../types.ts";

interface RecordWithUser extends AttendanceRecord {
  userName: string;
}

// JST時刻のday fraction (0〜1) に変換
function timeToDayFraction(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = dayjs(iso).tz("Asia/Tokyo");
  return (d.hour() * 60 + d.minute()) / 1440;
}

// 分数 → day fraction
function minutesToDayFraction(minutes: number): number {
  return minutes / 1440;
}

function calcBreakMinutes(rec: RecordWithUser): number {
  if (!rec.breakStart || !rec.breakEnd) return 0;
  const start = new Date(rec.breakStart).getTime();
  const end = new Date(rec.breakEnd).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

function calcWorkMinutes(rec: RecordWithUser): number {
  if (!rec.checkIn || !rec.checkOut) return 0;
  const checkIn = new Date(rec.checkIn).getTime();
  const checkOut = new Date(rec.checkOut).getTime();
  const total = Math.max(0, Math.round((checkOut - checkIn) / 60000));
  return Math.max(0, total - calcBreakMinutes(rec));
}

/**
 * 指定月の勤怠Excelを生成してUint8Arrayで返す
 * @param year 西暦4桁
 * @param month 1-12
 */
export async function generateMonthlyXlsxBuffer(
  year: number,
  month: number,
): Promise<Uint8Array> {
  const db = getDb();

  // 月の範囲（JST基準）
  const monthStart = dayjs.tz(
    `${year}-${String(month).padStart(2, "0")}-01 00:00:00`,
    "Asia/Tokyo",
  );
  const monthEnd = monthStart.add(1, "month");
  const daysInMonth = monthStart.daysInMonth();

  // 該当月のレコードをユーザー名昇順・日付昇順で取得
  const stmt = db.prepare(`
    SELECT ar.*, u.name as userName
    FROM AttendanceRecord ar
    JOIN User u ON ar.userId = u.id
    WHERE ar.date >= ? AND ar.date < ?
    ORDER BY u.name ASC, ar.date ASC
  `);
  const records = stmt.all(
    monthStart.toISOString(),
    monthEnd.toISOString(),
  ) as RecordWithUser[];

  // ユーザー → 日付(1-31) → レコード のマップに整理
  const usersMap = new Map<string, Map<number, RecordWithUser>>();
  for (const rec of records) {
    if (!usersMap.has(rec.userName)) {
      usersMap.set(rec.userName, new Map());
    }
    const day = dayjs(rec.date).tz("Asia/Tokyo").date();
    usersMap.get(rec.userName)!.set(day, rec);
  }

  // ===== Excel生成 =====
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");

  // 行1: ヘッダー（A=名前, B=総合計時間, C以降=日付2列ペア）
  ws.getCell("A1").value = "名前";
  ws.getCell("B1").value = "総合計時間";
  for (let day = 1; day <= daysInMonth; day++) {
    const colIdx = 3 + (day - 1) * 2;
    const cell = ws.getCell(1, colIdx);
    cell.value = new Date(year, month - 1, day);
    cell.numFmt = "m/d";
  }

  // 各ユーザー2行ずつ追加
  let rowIdx = 2;
  for (const [userName, dayMap] of usersMap) {
    const upperRow = rowIdx; // 出社/退社の行
    const lowerRow = rowIdx + 1; // 休憩/勤務時間の行

    ws.getCell(upperRow, 1).value = userName;
    ws.getCell(lowerRow, 1).value = "休憩/合計";

    let totalWorkMinutes = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const leftCol = 3 + (day - 1) * 2; // 出社時刻 / 休憩時間
      const rightCol = leftCol + 1; // 退社時刻 / 勤務時間
      const rec = dayMap.get(day);

      if (rec && rec.checkIn) {
        // 出社時刻
        const ci = timeToDayFraction(rec.checkIn);
        if (ci !== null) {
          const cell = ws.getCell(upperRow, leftCol);
          cell.value = ci;
          cell.numFmt = "h:mm";
        }
        // 退社時刻
        const co = timeToDayFraction(rec.checkOut);
        if (co !== null) {
          const cell = ws.getCell(upperRow, rightCol);
          cell.value = co;
          cell.numFmt = "h:mm";
        }
        // 休憩時間
        const breakMin = calcBreakMinutes(rec);
        if (breakMin > 0) {
          const cell = ws.getCell(lowerRow, leftCol);
          cell.value = minutesToDayFraction(breakMin);
          cell.numFmt = "h:mm";
        }
        // 勤務時間
        const workMin = calcWorkMinutes(rec);
        const workCell = ws.getCell(lowerRow, rightCol);
        workCell.value = minutesToDayFraction(workMin);
        workCell.numFmt = "h:mm";

        totalWorkMinutes += workMin;
      } else {
        // サンプル準拠: 出退社空欄、勤務時間セルに0:00
        const workCell = ws.getCell(lowerRow, rightCol);
        workCell.value = 0;
        workCell.numFmt = "h:mm";
      }
    }

    // 月間総合計（B列、24h超対応書式）
    const totalCell = ws.getCell(lowerRow, 2);
    totalCell.value = minutesToDayFraction(totalWorkMinutes);
    totalCell.numFmt = "[h]:mm;@";

    rowIdx += 2;
  }

  // 列幅調整
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 12;
  for (let day = 1; day <= daysInMonth; day++) {
    const leftCol = 3 + (day - 1) * 2;
    ws.getColumn(leftCol).width = 6;
    ws.getColumn(leftCol + 1).width = 6;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
