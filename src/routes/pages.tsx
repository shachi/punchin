// attendance-deno/src/routes/pages.tsx
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { getDb } from "../db/client.ts";
import { getBusinessDayRange } from "../lib/dayjs.ts";
import { authMiddleware, requireAuth, requireAdmin } from "../middleware/auth.ts";
import type { AppEnv, UserState, AttendanceRecord } from "../types.ts";

// ページコンポーネント
import { Layout } from "../views/Layout.tsx";
import { HomePage } from "../views/pages/HomePage.tsx";
import { LoginPage } from "../views/pages/LoginPage.tsx";
import { RegisterPage } from "../views/pages/RegisterPage.tsx";
import { DashboardPage } from "../views/pages/DashboardPage.tsx";
import { AdminPage } from "../views/pages/AdminPage.tsx";
import { EditRequestsPage } from "../views/pages/EditRequestsPage.tsx";

export const pageRoutes = new Hono<AppEnv>();

// 認証状態チェック（リダイレクト用）
pageRoutes.use("*", authMiddleware);

// ホームページ
pageRoutes.get("/", (c) => {
  const user = c.get("user");
  
  // ログイン済みならリダイレクト
  if (user) {
    const redirectTo = user.isAdmin ? "/admin" : "/dashboard";
    return c.redirect(redirectTo);
  }
  
  return c.html(
    <Layout title="勤怠管理システム - ホーム">
      <HomePage />
    </Layout>
  );
});

// ログインページ
pageRoutes.get("/login", (c) => {
  const user = c.get("user");
  
  // ログイン済みならリダイレクト
  if (user) {
    return c.redirect("/dashboard");
  }
  
  const url = new URL(c.req.url);
  const registered = url.searchParams.get("registered") === "true";
  
  return c.html(
    <Layout title="ログイン">
      <LoginPage registered={registered} />
    </Layout>
  );
});

// 新規登録ページ
pageRoutes.get("/register", (c) => {
  const user = c.get("user");
  
  // ログイン済みならリダイレクト
  if (user) {
    return c.redirect("/dashboard");
  }
  
  return c.html(
    <Layout title="新規登録">
      <RegisterPage />
    </Layout>
  );
});

// ダッシュボードページ（認証必須）
pageRoutes.get("/dashboard", requireAuth, (c) => {
  const user = c.get("user")!;
  const db = getDb();
  
  // ユーザー状態を取得
  const stateStmt = db.prepare("SELECT * FROM UserState WHERE userId = ?");
  const userState = stateStmt.get(user.id) as UserState | undefined;
  
  // 今日の勤怠記録を取得
  const { start, end } = getBusinessDayRange();
  const recordStmt = db.prepare(
    "SELECT * FROM AttendanceRecord WHERE userId = ? AND date >= ? AND date <= ?"
  );
  const record = recordStmt.get(user.id, start.toISOString(), end.toISOString()) as AttendanceRecord | undefined;
  
  const currentState = userState?.currentState || "not_checked_in";
  
  return c.html(
    <Layout title="ダッシュボード" user={user}>
      <DashboardPage 
        user={user}
        currentState={currentState as any}
        record={record}
      />
    </Layout>
  );
});

// 管理者ページ（管理者権限必須）
pageRoutes.get("/admin", requireAdmin, (c) => {
  const user = c.get("user")!;
  
  return c.html(
    <Layout title="管理者ダッシュボード" user={user}>
      <AdminPage />
    </Layout>
  );
});

// 時刻修正申請ページ（管理者権限必須）
pageRoutes.get("/admin/edit-requests", requireAdmin, (c) => {
  const user = c.get("user")!;
  const db = getDb();
  
  // 修正申請一覧を取得（ユーザー情報も含む）
  const stmt = db.prepare(`
    SELECT 
      r.*,
      u.name as userName
    FROM TimeEditRequest r
    LEFT JOIN User u ON r.userId = u.id
    ORDER BY 
      CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
      r.createdAt DESC
  `);
  const requests = stmt.all() as any[];
  
  return c.html(
    <Layout title="時刻修正申請" user={user}>
      <EditRequestsPage requests={requests} />
    </Layout>
  );
});
