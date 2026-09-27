// tests/edit_requests_test.ts
// 時刻修正申請まわりの結合テスト（実際のルートを app.request() で叩く）
//
// 実行: deno task test
// ※ 申請時刻の変換はサーバーのTZに依存するため、deno task では TZ=Asia/Tokyo で実行する

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "@std/assert";
import dayjs from "../src/lib/dayjs.ts";
import {
  insertRecord,
  insertRequest,
  resetData,
  setupTestApp,
  teardownTestApp,
} from "./_setup.ts";

// 業務日 2026/09/26(土) のレコード（値はUTCのISO文字列）
//   出社 9:01 / 退社 18:02 / 休憩 12:00〜13:00（JST）
const RECORD = {
  id: "rec-1",
  date: "2026-09-25T15:00:00.000Z", // 2026/09/26 0:00 JST
  checkIn: "2026-09-26T00:01:00.000Z",
  checkOut: "2026-09-26T09:02:00.000Z",
  breakStart: "2026-09-26T03:00:00.000Z",
  breakEnd: "2026-09-26T04:00:00.000Z",
};

const isJstProcess = new Date().getTimezoneOffset() === -540;

Deno.test("時刻修正申請", async (t) => {
  const ctx = await setupTestApp();

  try {
    await t.step("管理者: 申請一覧に申請者名と対象レコードの現在値が表示される", async () => {
      resetData(ctx);
      insertRecord(ctx, { ...RECORD, userId: ctx.userId });
      insertRequest(ctx, {
        id: "req-1",
        userId: ctx.userId,
        recordId: RECORD.id,
        field: "checkOut",
        oldValue: RECORD.checkOut,
        newValue: "2026-09-26T10:30:00.000Z", // 19:30 JST
      });

      const res = await ctx.app.request("/admin/edit-requests", {
        headers: { Cookie: ctx.adminCookie },
      });
      const html = await res.text();

      assertEquals(res.status, 200, html.slice(0, 500));
      assertStringIncludes(html, "山田太郎"); // u.name（JOIN User）
      assertStringIncludes(html, "退社時間");
      assertStringIncludes(html, "対象日");
      assertStringIncludes(html, "2026/09/26 (土)");
      assertStringIncludes(html, "9:01"); // 出社
      assertStringIncludes(html, "18:02"); // 退社
      assertStringIncludes(html, "8:01"); // 現在の勤務時間
      assertStringIncludes(html, "9:29"); // 承認後の勤務時間
      assertStringIncludes(html, "(承認後)");
    });

    await t.step("管理者: 対象レコードが無い申請があっても画面が落ちない", async () => {
      resetData(ctx);
      // 外部キー制約を一時的に外して、レコードが消えた状態を再現
      ctx.db.exec("PRAGMA foreign_keys = OFF");
      insertRequest(ctx, {
        id: "req-orphan",
        userId: ctx.userId,
        recordId: "deleted-record",
        field: "checkIn",
        oldValue: null,
        newValue: "2026-09-26T00:00:00.000Z",
      });
      ctx.db.exec("PRAGMA foreign_keys = ON");

      const res = await ctx.app.request("/admin/edit-requests", {
        headers: { Cookie: ctx.adminCookie },
      });
      const html = await res.text();

      assertEquals(res.status, 200, html.slice(0, 500));
      assertStringIncludes(html, "対象の勤怠レコードが見つかりません");
    });

    await t.step("一般ユーザーは申請一覧を開けない（/dashboard へリダイレクト）", async () => {
      const res = await ctx.app.request("/admin/edit-requests", {
        headers: { Cookie: ctx.userCookie },
      });
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/dashboard");
    });

    await t.step("一般ユーザー: 修正申請が保存される", async () => {
      resetData(ctx);
      insertRecord(ctx, { ...RECORD, userId: ctx.userId });

      const form = new FormData();
      form.set("recordId", RECORD.id);
      form.set("field", "checkOut");
      form.set("newValue", "19:30");
      form.set("reason", "打刻忘れ");

      const res = await ctx.app.request("/api/attendance/edit-request", {
        method: "POST",
        headers: { Cookie: ctx.userCookie },
        body: form,
      });
      const json = await res.json();

      assertEquals(res.status, 200, JSON.stringify(json));
      assertEquals(json.success, true);

      const rows = ctx.db.prepare(
        "SELECT * FROM TimeEditRequest WHERE recordId = ?",
      ).all(RECORD.id) as Array<Record<string, string | null>>;
      assertEquals(rows.length, 1);
      assertEquals(rows[0].field, "checkOut");
      assertEquals(rows[0].oldValue, RECORD.checkOut);
      assertEquals(rows[0].status, "pending");

      if (isJstProcess) {
        const jst = dayjs(rows[0].newValue as string).tz("Asia/Tokyo");
        assertEquals(jst.format("YYYY-MM-DD HH:mm"), "2026-09-26 19:30");
      } else {
        console.warn(
          "⚠ TZ が Asia/Tokyo ではないため、修正値の時刻チェックをスキップしました（deno task test で実行してください）",
        );
      }
    });

    await t.step("一般ユーザー: 他人のレコードには申請できない", async () => {
      resetData(ctx);
      insertRecord(ctx, { ...RECORD, userId: ctx.adminId });

      const form = new FormData();
      form.set("recordId", RECORD.id);
      form.set("field", "checkOut");
      form.set("newValue", "19:30");
      form.set("reason", "打刻忘れ");

      const res = await ctx.app.request("/api/attendance/edit-request", {
        method: "POST",
        headers: { Cookie: ctx.userCookie },
        body: form,
      });
      await res.body?.cancel();
      assertEquals(res.status, 403);
    });

    await t.step("管理者: 承認するとレコードの時刻が更新される", async () => {
      resetData(ctx);
      insertRecord(ctx, { ...RECORD, userId: ctx.userId });
      const newValue = "2026-09-26T10:30:00.000Z";
      insertRequest(ctx, {
        id: "req-approve",
        userId: ctx.userId,
        recordId: RECORD.id,
        field: "checkOut",
        oldValue: RECORD.checkOut,
        newValue,
      });

      const res = await ctx.app.request(
        "/api/admin/edit-requests/req-approve/approve",
        { method: "POST", headers: { Cookie: ctx.adminCookie } },
      );
      await res.body?.cancel();
      assertEquals(res.status, 302);
      assertEquals(
        res.headers.get("Location"),
        "/admin/edit-requests?success=approved",
      );

      const record = ctx.db.prepare(
        "SELECT checkOut FROM AttendanceRecord WHERE id = ?",
      ).get(RECORD.id) as { checkOut: string };
      assertEquals(record.checkOut, newValue);

      const req = ctx.db.prepare(
        "SELECT status FROM TimeEditRequest WHERE id = ?",
      ).get("req-approve") as { status: string };
      assertEquals(req.status, "approved");
    });

    await t.step("管理者: 拒否するとレコードは変わらない", async () => {
      resetData(ctx);
      insertRecord(ctx, { ...RECORD, userId: ctx.userId });
      insertRequest(ctx, {
        id: "req-reject",
        userId: ctx.userId,
        recordId: RECORD.id,
        field: "checkOut",
        oldValue: RECORD.checkOut,
        newValue: "2026-09-26T10:30:00.000Z",
      });

      const res = await ctx.app.request(
        "/api/admin/edit-requests/req-reject/reject",
        { method: "POST", headers: { Cookie: ctx.adminCookie } },
      );
      await res.body?.cancel();
      assertEquals(res.status, 302);

      const record = ctx.db.prepare(
        "SELECT checkOut FROM AttendanceRecord WHERE id = ?",
      ).get(RECORD.id) as { checkOut: string };
      assertEquals(record.checkOut, RECORD.checkOut);

      const req = ctx.db.prepare(
        "SELECT status FROM TimeEditRequest WHERE id = ?",
      ).get("req-reject") as { status: string };
      assert(req.status === "rejected");
    });
  } finally {
    await teardownTestApp();
  }
});
