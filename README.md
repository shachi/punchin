# PunchIn - 勤怠管理システム

[![Deno](https://img.shields.io/badge/Deno-2.6.x-blue?logo=deno)](https://deno.land/)
[![Hono](https://img.shields.io/badge/Hono-4.x-orange)](https://hono.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

シンプルで軽量な勤怠管理システムです。Deno + Hono + SQLiteで構築されており、セットアップが簡単で即座に利用開始できます。

## ✨ 機能

### 一般ユーザー向け
- 📥 **出社** / **退社** / **再出社** 打刻
- ☕ **休憩開始** / **休憩終了** 打刻
- 🏠 **欠勤** 登録
- ⏰ リアルタイム時計表示
- 📝 打刻時刻の修正申請

### 管理者向け
- 📊 全ユーザーの勤怠一覧表示（日付範囲指定・ページング対応）
- 📅 月間勤怠レポート
- 📄 CSV出力（日別明細 + 月間合計）
- ✅ 時刻修正申請の承認/拒否

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---------|------|
| ランタイム | [Deno](https://deno.land/) 2.6.x |
| Webフレームワーク | [Hono](https://hono.dev/) 4.x |
| データベース | SQLite |
| 認証 | JWT (Cookie-based) |
| パスワード | bcryptjs |
| 日時処理 | Day.js (Asia/Tokyo タイムゾーン対応) |
| UI | JSX + Tailwind CSS |

## 📁 プロジェクト構成

```
punchin/
├── main.ts                 # エントリーポイント
├── deno.json               # Deno設定・タスク定義
├── src/
│   ├── app.ts              # Honoアプリケーション設定
│   ├── types.ts            # 型定義
│   ├── db/
│   │   ├── client.ts       # DBクライアント
│   │   ├── init.ts         # DB初期化
│   │   ├── schema.sql      # テーブル定義
│   │   └── seed.ts         # 初期データ投入
│   ├── lib/
│   │   ├── dayjs.ts        # 日時処理ユーティリティ
│   │   ├── jwt.ts          # JWT認証
│   │   └── password.ts     # パスワードハッシュ
│   ├── middleware/
│   │   └── auth.ts         # 認証ミドルウェア
│   ├── routes/
│   │   ├── admin.tsx       # 管理者API
│   │   ├── attendance.tsx  # 勤怠API
│   │   ├── auth.ts         # 認証API
│   │   └── pages.tsx       # ページルーティング
│   └── views/
│       ├── Layout.tsx      # 共通レイアウト
│       ├── components/     # UIコンポーネント
│       └── pages/          # ページコンポーネント
└── static/
    └── css/                # スタイルシート
```

## 🚀 セットアップ

### 前提条件

- [Deno](https://deno.land/) 2.x がインストールされていること

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/punchin.git
cd punchin

# データベースを初期化
deno task init-db

# 初期データを投入（管理者ユーザー作成）
deno task seed
```

### 起動

```bash
# 開発モード（ホットリロード有効）
deno task dev

# 本番モード
deno task start
```

サーバーが起動したら http://localhost:3000 にアクセスしてください。

### 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `PORT` | `3000` | サーバーのポート番号 |
| `JWT_SECRET` | 自動生成 | JWT署名用シークレット |

## 👤 初期アカウント

シードデータ投入後、以下のアカウントでログインできます：

| 種別 | Email | Password |
|------|-------|----------|
| 管理者 | admin@example.com | admin123 |

> ⚠️ **本番環境では必ずパスワードを変更してください**

## 📖 使い方

### 一般ユーザー

1. ログイン後、ダッシュボードにアクセス
2. 「出社」ボタンで出勤打刻
3. 休憩時は「休憩開始」→「休憩終了」
4. 業務終了時に「退社」ボタンで退勤打刻
5. 打刻ミスがあれば「修正申請」から申請

### 管理者

1. 管理者アカウントでログイン
2. ヘッダーの「管理画面」リンクから管理ページへ
3. 日付範囲を指定して勤怠記録を確認
4. 「月次CSVエクスポート」でレポート出力
5. 「時刻修正申請」から申請の承認/拒否

## 📝 API エンドポイント

### 認証
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/auth/register` | ユーザー登録 |
| POST | `/api/auth/login` | ログイン |
| POST | `/api/auth/logout` | ログアウト |

### 勤怠
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/attendance/state` | 現在の状態取得 |
| POST | `/api/attendance/check-in` | 出社 |
| POST | `/api/attendance/check-out` | 退社 |
| POST | `/api/attendance/recheck-in` | 再出社 |
| POST | `/api/attendance/start-break` | 休憩開始 |
| POST | `/api/attendance/end-break` | 休憩終了 |
| POST | `/api/attendance/absent` | 欠勤 |
| POST | `/api/attendance/edit-request` | 修正申請 |
| GET | `/api/attendance/edit-requests` | 修正申請一覧 |

### 管理者
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/admin/attendance` | 勤怠一覧 |
| GET | `/api/admin/export-csv` | CSV出力 |
| GET | `/api/admin/edit-requests` | 修正申請一覧 |
| POST | `/api/admin/process-edit-request` | 申請処理 |

## 🗓️ 業務日の考え方

このシステムでは **午前4時** を業務日の境界としています。

- 午前4時〜翌日午前3時59分 = 1業務日
- 深夜勤務がある場合でも、正しく同一業務日として記録されます

## 🤝 Contributing

プルリクエストを歓迎します。大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。

## 📄 License

[MIT](LICENSE)

---

Made with ❤️ using Deno and Hono
