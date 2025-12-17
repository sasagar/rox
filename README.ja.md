<p align="center">
  <img src="docs/assets/logo.svg" alt="Rox Logo" width="120" height="120" />
</p>

<h1 align="center">Rox</h1>

<p align="center">
  <strong>軽量なActivityPubサーバー&クライアント、Misskey API互換対応</strong>
</p>

<p align="center">
  <a href="https://github.com/Love-Rox/rox/actions/workflows/ci.yml">
    <img src="https://github.com/Love-Rox/rox/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <a href="https://github.com/Love-Rox/rox/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Love-Rox/rox?color=blue" alt="License" />
  </a>
  <a href="https://github.com/Love-Rox/rox/releases">
    <img src="https://img.shields.io/github/v/release/Love-Rox/rox?include_prereleases&color=green" alt="Release" />
  </a>
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=black" alt="Bun" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tests-800%2B-brightgreen" alt="Tests" />
</p>

<p align="center">
  <a href="https://activitypub.rocks/">
    <img src="https://img.shields.io/badge/ActivityPub-Federated-purple?logo=activitypub" alt="ActivityPub" />
  </a>
  <img src="https://img.shields.io/badge/Misskey_API-Compatible-86b300?logo=misskey" alt="Misskey Compatible" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supported-336791?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Love-Rox/rox?utm_source=oss&utm_medium=github&utm_campaign=Love-Rox%2Frox&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
</p>

<p align="center">
  <b>Languages</b>: <a href="./README.md">English</a> | 日本語
</p>

---

## ハイライト

| | | | |
|:---:|:---:|:---:|:---:|
| ⚡ | 🖥️ | 🌐 | 🔒 |
| **超高速** | **インフラ非依存** | **完全連合** | **セキュア設計** |
| Bunランタイムで最高のパフォーマンス | VPS、Docker、エッジ環境で動作 | Mastodon、Misskeyなどと連携 | Passkey、OAuth、ロールベース権限 |

## 特徴

- **軽量・高パフォーマンス** - Bunランタイムとモダンなウェブ標準で構築
- **インフラ非依存** - 従来型VPS（Docker）またはエッジ環境（Cloudflare Workers/D1）で実行可能
- **Misskey API互換** - 既存Misskeyユーザーのシームレスな移行
- **マルチデータベース対応** - PostgreSQL、MySQL、SQLite/D1
- **柔軟なストレージ** - ローカルファイルシステムまたはS3互換ストレージ（AWS S3、Cloudflare R2、MinIO）
- **複数認証方式** - パスワード、Passkey（WebAuthn）、OAuth（GitHub、Google、Discord、Mastodon）
- **完全なActivityPubサポート** - Mastodon、Misskey、GoToSocialなどと連携
- **ロールベース権限** - Misskeyスタイルのポリシーシステムできめ細かいアクセス制御
- **国際化対応** - 英語と日本語をすぐに利用可能

## スクリーンショット

<details>
<summary>クリックしてスクリーンショットを表示</summary>

> 準備中

</details>

## クイックスタート

### 必要な環境

- [Bun](https://bun.sh/) >= 1.0.0
- [Docker](https://www.docker.com/) と Docker Compose（ローカル開発用）
- PostgreSQL >= 14（または MySQL >= 8.0、SQLite）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/Love-Rox/rox.git
cd rox

# 依存関係をインストール
bun install

# 環境変数を設定
cp .env.example .env
# .envファイルを編集して設定を変更

# 開発サービスを起動（PostgreSQL + MariaDB + Dragonfly）
docker compose -f docker/compose.dev.yml up -d

# データベースマイグレーションを実行
bun run db:generate
bun run db:migrate

# 開発サーバーを起動
bun run dev
```

バックエンドAPIは `http://localhost:3000`、フロントエンドは `http://localhost:3001` で利用可能になります。

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

## 技術スタック

### バックエンド（Hono Rox）

| カテゴリ | 技術 | 用途 |
|----------|-----------|---------|
| ランタイム | **Bun** | 高速JavaScriptランタイム、パッケージマネージャー、テストランナー |
| 言語 | **TypeScript** | 型安全性と開発効率 |
| フレームワーク | **Hono** | 超軽量Webフレームワーク |
| ORM | **Drizzle ORM** | TypeScriptファーストORM |
| キュー | **Dragonfly / BullMQ** | 非同期ジョブ処理 |
| コード品質 | **oxc** | リントとフォーマット |

### フロントエンド（Waku Rox）

| カテゴリ | 技術 | 用途 |
|----------|-----------|---------|
| フレームワーク | **Waku** | React Server Componentsフレームワーク |
| 状態管理 | **Jotai** | アトミックな状態管理 |
| UIコンポーネント | **React Aria** | アクセシブルなヘッドレスUI |
| スタイリング | **Tailwind CSS v4** | ユーティリティファーストCSS（OKLCH色空間） |
| 国際化 | **Lingui** | 3kb最適化i18n |

## 開発

### 利用可能なスクリプト

| スクリプト | 説明 |
|--------|-------------|
| `bun run dev` | 全ての開発サーバーを起動 |
| `bun run build` | 全てのパッケージをビルド |
| `bun run test` | テストを実行 |
| `bun run lint` | oxlintでコードをリント |
| `bun run format` | oxlintでコードをフォーマット |
| `bun run typecheck` | 全パッケージの型チェック |
| `bun run db:generate` | データベースマイグレーションを生成 |
| `bun run db:migrate` | データベースマイグレーションを実行 |
| `bun run db:studio` | Drizzle Studioを開く |

### データベース設定

<details>
<summary><b>PostgreSQL（デフォルト）</b></summary>

```bash
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
```
</details>

<details>
<summary><b>MySQL/MariaDB</b></summary>

```bash
# MariaDBは開発用composeに含まれています
docker compose -f docker/compose.dev.yml up -d

DB_TYPE=mysql
DATABASE_URL=mysql://rox:rox_dev_password@localhost:3306/rox
```
</details>

<details>
<summary><b>SQLite</b></summary>

```bash
DB_TYPE=sqlite
DATABASE_URL=sqlite://./rox.db
```
</details>

### ストレージ設定

<details>
<summary><b>ローカルストレージ（開発）</b></summary>

```bash
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
```
</details>

<details>
<summary><b>S3互換ストレージ</b></summary>

```bash
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_BUCKET_NAME=rox-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=auto
```
</details>

### OAuth設定

<details>
<summary><b>GitHub、Google、Discord、Mastodon</b></summary>

#### GitHub
```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=https://your-domain.com/api/auth/oauth/github/callback
```

#### Google
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/oauth/google/callback
```

#### Discord
```bash
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/oauth/discord/callback
```

#### Mastodon
```bash
MASTODON_CLIENT_ID=your-client-id
MASTODON_CLIENT_SECRET=your-client-secret
MASTODON_INSTANCE_URL=https://mastodon.social
MASTODON_REDIRECT_URI=https://your-domain.com/api/auth/oauth/mastodon/callback
```
</details>

## アーキテクチャ

Roxは**リポジトリパターン**と**アダプターパターン**を使用して、ビジネスロジックをインフラストラクチャの懸念事項から分離しています：

```
┌─────────────────────────────────────────────────────────────┐
│                      Hono Routes                            │
├─────────────────────────────────────────────────────────────┤
│                    Business Services                         │
├─────────────────────────────────────────────────────────────┤
│          Repository Interfaces │ Adapter Interfaces          │
├────────────────────────────────┼────────────────────────────┤
│  PostgreSQL │ MySQL │ SQLite   │  Local │ S3 │ R2           │
└────────────────────────────────┴────────────────────────────┘
```

- **リポジトリパターン**: データベース操作はインターフェースを通じて抽象化
- **アダプターパターン**: ストレージ操作は異なるバックエンド用のアダプターを使用
- **依存性注入**: Hono Context経由で実装を注入

詳細なアーキテクチャドキュメントは [実装ガイド](./docs/implementation/README.md) を参照してください。

## 実装状況

| フェーズ | 状況 | 説明 |
|-------|--------|-------------|
| Phase 0 | ✅ 完了 | 基盤（データベース、ストレージ、DI） |
| Phase 1 | ✅ 完了 | Misskey互換API |
| Phase 2 | ✅ 完了 | フロントエンド（Wakuクライアント） |
| Phase 3 | ✅ 完了 | ActivityPub連合 |
| Phase 4 | ✅ 完了 | リファクタリング＆最適化 |
| Phase 5 | ✅ 完了 | 管理機能＆セキュリティ強化 |
| Phase 6 | ✅ 完了 | 本番環境対応 |
| Phase 7 | 🚧 計画中 | プラグインシステム |

<details>
<summary><b>詳細な実装状況を表示</b></summary>

### Phase 2: フロントエンド
- ✅ Waku + Jotaiセットアップ
- ✅ Tailwind CSS v4（OKLCH色空間対応）
- ✅ React Aria Components
- ✅ Lingui国際化（英語/日本語）
- ✅ 認証（Passkey + Password + OAuth）
- ✅ タイムライン（無限スクロール）
- ✅ ノート投稿（テキスト、画像、CW、公開範囲）
- ✅ ユーザーインタラクション（リプライ、リアクション、フォロー）
- ✅ ファイルアップロード（ドラッグ&ドロップ、プレビュー）
- ✅ ユーザープロフィール
- ✅ 画像モーダル（ズーム、パン、ギャラリー）
- ✅ 完全なアクセシビリティ対応

### Phase 3: ActivityPub
- ✅ WebFinger（RFC 7033）
- ✅ Actorドキュメント（Person、JSON-LD）
- ✅ HTTP署名（RSA-SHA256、hs2019）
- ✅ Inbox（11種類のアクティビティ）
- ✅ Outbox & Collections
- ✅ アクティビティ配信キュー
- ✅ 共有Inboxサポート
- ✅ 連携テスト済み（Mastodon、Misskey、GoToSocial）

### Phase 5: 管理機能
- ✅ ロールベース権限システム
- ✅ ユーザー管理API
- ✅ インスタンスブロック管理
- ✅ 招待制ユーザー登録
- ✅ ユーザー通報システム
- ✅ インスタンス設定管理

</details>

## コントリビューション

コントリビューションを歓迎します！PRを送信する前に[コントリビューションガイドライン](./CONTRIBUTING.ja.md)をお読みください。

**重要ポイント：**

- TSDocコメントは必ず英語で記述
- リポジトリパターンとアダプターパターンに従う
- 送信前に `bun run lint && bun run typecheck && bun test` を実行
- Conventional Commitメッセージを使用

## ライセンス

[MIT](./LICENSE)

## リンク

| リソース | 説明 |
|----------|-------------|
| [コントリビューションガイドライン](./CONTRIBUTING.ja.md) | 貢献方法 |
| [DevContainerガイド](./docs/development/devcontainer.ja.md) | VS Code/Cursor DevContainerセットアップ |
| [プロジェクト仕様書](./docs/project/v1.md) | 元の仕様書（日本語） |
| [実装ガイド](./docs/implementation/README.md) | アーキテクチャ詳細 |
| [テストガイド](./docs/development/testing.ja.md) | テストドキュメント |
| [デプロイガイド](./docs/deployment/README.md) | 本番デプロイ |

---

<p align="center">
  Made with ❤️ by the Rox community
</p>
