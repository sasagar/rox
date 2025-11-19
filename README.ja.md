# Rox

軽量なActivityPubサーバー&クライアント、Misskey API互換対応。

**Languages**: [English](./README.md) | 日本語

## 特徴

- **軽量・高パフォーマンス**: Bunランタイムとモダンなウェブ標準で構築
- **インフラ非依存**: 従来型VPS（Docker）またはエッジ環境（Cloudflare Workers/D1）で実行可能
- **Misskey API互換**: 既存Misskeyユーザーのシームレスな移行
- **マルチデータベース対応**: PostgreSQL、MySQL、SQLite/D1
- **柔軟なストレージ**: ローカルファイルシステムまたはS3互換ストレージ（AWS S3、Cloudflare R2、MinIO）

## プロジェクト構造

```
rox/
├── packages/
│   ├── backend/   # Hono Rox (APIサーバー)
│   ├── frontend/  # Waku Rox (Webクライアント)
│   └── shared/    # 共通型とユーティリティ
├── docs/          # ドキュメント
├── docker/        # Docker設定
└── scripts/       # ビルド・デプロイスクリプト
```

## 必要な環境

- [Bun](https://bun.sh/) >= 1.0.0
- [Docker](https://www.docker.com/) と Docker Compose（ローカル開発用）
- PostgreSQL >= 14 （または MySQL >= 8.0、SQLite）

## クイックスタート

### 1. リポジトリをクローン

```bash
git clone https://github.com/yourusername/rox.git
cd rox
```

### 2. 依存関係をインストール

```bash
bun install
```

### 3. 環境変数を設定

```bash
cp .env.example .env
# .envファイルを編集して設定を変更
```

### 4. 開発サービスを起動

```bash
# PostgreSQLとDragonflyを起動
docker compose up -d

# サービスが正常に起動するまで待機
docker compose ps
```

### 5. データベースマイグレーションを実行

```bash
bun run db:generate
bun run db:migrate
```

### 6. 開発サーバーを起動

```bash
# バックエンドとフロントエンドの両方を起動
bun run dev

# または個別に起動
bun run backend:dev
bun run frontend:dev
```

バックエンドAPIは `http://localhost:3000`、フロントエンドは `http://localhost:3001` で利用可能になります。

## 開発

### 利用可能なスクリプト

- `bun run dev` - 全ての開発サーバーを起動
- `bun run build` - 全てのパッケージをビルド
- `bun run test` - テストを実行
- `bun run lint` - oxlintでコードをリント
- `bun run format` - oxlintでコードをフォーマット
- `bun run typecheck` - 全パッケージの型チェック
- `bun run db:generate` - データベースマイグレーションを生成
- `bun run db:migrate` - データベースマイグレーションを実行
- `bun run db:studio` - Drizzle Studioを開く

### データベース管理

#### PostgreSQL（デフォルト）

```bash
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
```

#### MySQL

```bash
# MySQLサービスを起動
docker compose --profile mysql up -d

DB_TYPE=mysql
DATABASE_URL=mysql://rox:rox_dev_password@localhost:3306/rox
```

#### SQLite（ローカル開発）

```bash
DB_TYPE=sqlite
DATABASE_URL=sqlite://./rox.db
```

### ストレージ設定

#### ローカルストレージ（開発）

```bash
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
```

#### S3互換ストレージ

```bash
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_BUCKET_NAME=rox-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=auto
```

## アーキテクチャ

Roxは**リポジトリパターン**と**アダプターパターン**を使用して、ビジネスロジックをインフラストラクチャの懸念事項から分離しています：

- **リポジトリパターン**: データベース操作はインターフェース（`INoteRepository`、`IUserRepository`など）を通じて抽象化
- **アダプターパターン**: ストレージ操作はアダプター（`LocalStorageAdapter`、`S3StorageAdapter`）を使用
- **依存性注入**: 環境変数に基づいてHono Context経由で実装を注入

詳細なアーキテクチャドキュメントは [実装ガイド](./docs/implementation/README.md) を参照してください。

## 技術スタック

| カテゴリ | 技術 | 用途 |
|----------|-----------|---------|
| ランタイム | Bun | 高速JavaScriptランタイム、パッケージマネージャー、テストランナー |
| 言語 | TypeScript | 型安全性と開発効率 |
| バックエンド | Hono | 超軽量Webフレームワーク |
| フロントエンド | Waku | React Server Componentsフレームワーク |
| 状態管理 | Jotai | アトミックな状態管理 |
| スタイリング | Tailwind CSS | ユーティリティファーストCSS |
| ORM | Drizzle ORM | TypeScriptファーストORM |
| キュー | Dragonfly / BullMQ | 非同期ジョブ処理 |
| コード品質 | oxc | リントとフォーマット |

## 実装フェーズ

- **Phase 0**: 基盤（データベース、ストレージ、DI）✅ 完了
- **Phase 1**: Misskey互換API 🔄 進行中（30%）
- **Phase 2**: フロントエンド（Wakuクライアント）
- **Phase 3**: ActivityPub連合

## コントリビューション

コントリビューションを歓迎します！PRを送信する前に[コントリビューションガイドライン](./CONTRIBUTING.ja.md)をお読みください。

**重要ポイント：**

- TSDocコメントは必ず英語で記述
- リポジトリパターンとアダプターパターンに従う
- 送信前に `bun run lint && bun run typecheck && bun test` を実行
- Conventional Commitメッセージを使用

## ライセンス

MIT

## リンク

- [コントリビューションガイドライン](./CONTRIBUTING.ja.md)
- [プロジェクト仕様書](./docs/project/v1.md)（日本語）
- [実装ガイド](./docs/implementation/README.md)
- [APIドキュメント](./docs/api/)（準備中）
