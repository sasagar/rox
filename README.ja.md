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
git clone https://github.com/Love-rox/rox.git
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
- `bun run db:backup` - データベースをバックアップ（PostgreSQLネイティブ形式）
- `bun run db:restore` - バックアップからデータベースを復元
- `bun run db:export` - データベースをJSONにエクスポート（異種DB間移行用）
- `bun run db:import` - JSONからデータベースにインポート

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

### バックエンド

| カテゴリ | 技術 | バージョン | 用途 |
|----------|-----------|---------|---------|
| ランタイム | Bun | 1.1.45+ | 高速JavaScriptランタイム、パッケージマネージャー、テストランナー |
| 言語 | TypeScript | 5.x | 型安全性と開発効率 |
| フレームワーク | Hono | 4.10.6 | 超軽量Webフレームワーク |
| ORM | Drizzle ORM | 0.36.4 | TypeScriptファーストORM |
| キュー | Dragonfly / BullMQ | - | 非同期ジョブ処理 |
| コード品質 | oxc | 最新 | リントとフォーマット |

### フロントエンド（✅ 実装済み）

| カテゴリ | 技術 | バージョン | 用途 |
|----------|-----------|---------|---------|
| フレームワーク | Waku | 0.27.1 | React Server Componentsフレームワーク |
| 状態管理 | Jotai | 2.15.1 | アトミックな状態管理 |
| UIコンポーネント | React Aria Components | 1.6.3 | アクセシブルなヘッドレスUI |
| スタイリング | Tailwind CSS v4 | 4.1.17 | ユーティリティファーストCSS（OKLCH色空間） |
| 国際化 | Lingui | 5.6.0 | 3kb最適化i18n（英語/日本語） |
| 認証 | Passkey + Password | カスタム実装 | WebAuthn + 従来型認証 |

## 実装フェーズ

- **Phase 0**: 基盤（データベース、ストレージ、DI）✅ **完了**
- **Phase 1**: Misskey互換API ✅ **完了**
- **Phase 2**: フロントエンド（Wakuクライアント）✅ **完了**
  - ✅ Waku + Jotaiセットアップ
  - ✅ Tailwind CSS v4（OKLCH色空間対応）
  - ✅ React Aria Components（Button、TextField、Dialog、Form、Avatar、Card）
  - ✅ Lingui国際化（英語/日本語 - 87メッセージ）
  - ✅ 認証（Passkey + Password）
  - ✅ タイムライン（表示、無限スクロール）
  - ✅ ノート投稿（テキスト、画像、CW、公開範囲、リプライ、リノート）
  - ✅ ユーザーインタラクション（リプライ、リアクション、フォロー/アンフォロー）
  - ✅ ファイルアップロード（複数画像、ドラッグ&ドロップ、プレビュー）
  - ✅ ユーザープロフィール（自己紹介、統計、投稿、フォローボタン）
  - ✅ 画像モーダル（ズーム、パン、ギャラリーナビゲーション）
  - ✅ アクセシビリティ（キーボード操作、フォーカス管理、ARIAラベル、スクリーンリーダー対応）
- **Phase 3**: ActivityPub連合 ✅ **完了**
  - ✅ WebFinger（RFC 7033準拠）
  - ✅ Actorドキュメント（Person、JSON-LD）
  - ✅ HTTP署名（RSA-SHA256、hs2019）
  - ✅ Inbox（11種類のアクティビティ：Follow、Undo Follow、Create、Like、Undo Like、Announce、Undo Announce、Delete、Accept、Update Person、Update Note）
  - ✅ Outbox & Collections（followers/following）
  - ✅ アクティビティ配信キュー（BullMQ + Dragonfly）
  - ✅ 共有Inboxサポート（配信数50-90%削減）
  - ✅ サーバー別レート制限
  - ✅ アクティビティ重複排除
  - ✅ 配信メトリクス＆モニタリング
  - ✅ 連携テスト済み（Mastodon、Misskey、GoToSocial）
- **Phase 4**: リファクタリング＆最適化 ✅ **完了**
  - ✅ コードリファクタリング（Inboxハンドラーを11個の専用ハンドラーに分割）
  - ✅ Redisキャッシング（CacheServiceによるユーザープロフィール）
  - ✅ 画像最適化（ImageProcessorによるWebP変換）
  - ✅ テストカバレッジ向上（342ユニットテスト）
- **Phase 5**: 管理機能＆セキュリティ強化 ✅ **完了**
  - ✅ 管理者権限システム（`requireAdmin`ミドルウェア）
  - ✅ ユーザー管理API（一覧、権限付与/剥奪、停止/解除、削除）
  - ✅ インスタンスブロック機能（受信/送信フィルタリング）
  - ✅ ユーザー停止機能（セッション無効化）
  - ✅ 招待制ユーザー登録システム（DB設定 + 環境変数フォールバック）
  - ✅ 招待コード管理API（作成、一覧、削除、有効期限、複数回使用）
  - ✅ ユーザー通報システム（8種類の通報理由）
  - ✅ モデレーション機能（通報管理、ノート削除）
  - ✅ **ロールベース権限システム**（Misskeyスタイルのポリシー）
    - ロールCRUD API（`/api/admin/roles`）
    - ロールの割り当て/解除
    - 権限ベースミドルウェア（`requirePermission`、`requireAdminRole`、`requireModeratorRole`）
    - 複数ロールからの有効ポリシー統合
    - ロール別招待制限とレート制限係数
  - ✅ **インスタンス設定管理API**（`/api/admin/settings`）
    - 登録設定（有効化、招待制、承認制）
    - インスタンスメタデータ（名前、説明、メンテナーメール、アイコン、利用規約、プライバシーポリシー）
- **Phase 6**: 本番環境対応 ✅ **完了**
  - ✅ 入力バリデーション（Zodスキーマ）
  - ✅ ヘルスチェック＆メトリクスエンドポイント
  - ✅ デプロイドキュメント（Docker＆ベアメタル）
  - ✅ CI/CDワークフロー（GitHub Actions）
  - ✅ 342ユニットテスト
- **Phase 7**: プラグインシステム（計画中）
  - プラグインアーキテクチャ設計
  - 拡張ポイント
  - プラグインマーケットプレイス

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
