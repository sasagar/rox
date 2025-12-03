# Rox Implementation Overview

**言語**: [English](./overview.en.md) | 日本語

## プロジェクト概要

Roxは、軽量かつ高性能なActivityPubサーバー＆クライアントです。Misskey互換APIを提供し、既存のMisskeyユーザーがスムーズに移行できるように設計されています。

## 設計原則

### 1. Infrastructure Agnostic（インフラ非依存）

- **Multi-Database Support**: PostgreSQL、MySQL、SQLite/Cloudflare D1に対応
- **Multi-Storage Support**: ローカルファイルシステム、S3互換ストレージに対応
- **Environment Variable Driven**: 環境変数でインフラを切り替え可能

### 2. Repository Pattern & Adapter Pattern

ビジネスロジックをインフラストラクチャから分離するため、以下のパターンを採用：

- **Repository Pattern**: データベース操作を抽象化
  - インターフェース: `INoteRepository`, `IUserRepository` など
  - 実装: `PostgresNoteRepository`, `MySQLNoteRepository`, `D1NoteRepository`

- **Adapter Pattern**: ストレージ操作を抽象化
  - インターフェース: `IFileStorage`
  - 実装: `LocalStorageAdapter`, `S3StorageAdapter`

### 3. Dependency Injection

Hono Contextを活用した依存性注入：

```typescript
// アプリケーション起動時に環境変数に基づいて実装を選択
const noteRepository = createNoteRepository(process.env.DB_TYPE);
app.use('*', async (c, next) => {
  c.set('noteRepository', noteRepository);
  await next();
});

// コントローラーでは抽象インターフェースに依存
app.get('/api/notes', async (c) => {
  const repo = c.get('noteRepository'); // INoteRepository
  const notes = await repo.getTimeline();
  return c.json(notes);
});
```

## 技術スタック

| カテゴリ | 技術 | 選定理由 |
|---------|------|---------|
| Runtime | Bun | 高速、パッケージマネージャ・テストランナー統合 |
| Language | TypeScript | 型安全性、開発効率 |
| Backend | Hono | 超軽量、Web標準準拠、エッジ互換 |
| Frontend | Waku | RSCネイティブサポート、最小構成 |
| State | Jotai | アトミック、再レンダリング最小化 |
| UI Components | React Aria Components | アクセシブル、ヘッドレスUI、WAI-ARIA準拠 |
| Icons | Lucide React | ツリーシェイキング対応、軽量、一貫性 |
| Styling | Tailwind CSS v4 | ビルド時最適化、OKLCH色空間 |
| i18n | Lingui | 可読性、自動化、最適化（3kb） |
| ORM | Drizzle ORM | TypeScriptファースト、軽量、マルチDB |
| Queue | Dragonfly/BullMQ | 非同期ジョブ処理（ActivityPub配送） |
| Lint/Format | oxc | Rust製、高速（ESLint/Prettier代替） |

## 実装フェーズ

### Phase 0: Foundation（基盤構築）

**目的:** インフラ抽象化層と開発環境の構築

**期間:** 1-2週間

**成果物:**
- モノレポ構造（backend/frontend/shared）
- Database抽象化層（Repository Pattern）
- Storage抽象化層（Adapter Pattern）
- Dependency Injection機構
- 開発ツール設定（TypeScript、oxc、Docker Compose）

**完了条件:**
- 環境変数でDB/ストレージを切り替え可能
- PostgreSQL、Local Storageで動作確認
- テストインフラ構築完了

### Phase 1: Misskey-Compatible API（Misskey互換API）

**目的:** ローカルSNSとして完全動作するバックエンドAPI

**期間:** 3-4週間

**主要機能:**
- 認証（MiAuth）
- アカウント管理
- ノート機能（投稿、タイムライン、リアクション）
- ファイル管理（ドライブ）

**完了条件:**
- 全Misskey互換エンドポイント実装
- Postman/Thunder Clientで動作確認
- テストカバレッジ80%以上

### Phase 2: Frontend（フロントエンド）✅ 完了

**目的:** 使いやすいWebクライアントの提供

**期間:** 3-4週間（完了日: 2025-11-25）

**主要機能:**
- ✅ 認証フロー（Passkey/パスワード）
- ✅ タイムライン表示（RSC活用、無限スクロール）
- ✅ 投稿機能（テキスト、画像、CW、公開範囲）
- ✅ ユーザーインタラクション（リアクション、リノート、返信、フォロー）
- ✅ UIコンポーネント（React Aria Components、Lucide React）
- ✅ アクセシビリティ対応（キーボードナビゲーション、ARIA属性）
- ✅ 国際化対応（Lingui、日本語・英語、127メッセージ）

**完了条件:**
- ✅ 全ユーザーフローが動作
- ✅ モバイルレスポンシブ対応
- ✅ WCAG 2.1 Level AA準拠

### Phase 3: ActivityPub Federation（連合）

**目的:** 他のActivityPubサーバーとの相互運用

**期間:** 4-5週間

**主要機能:**
- Actor & WebFinger
- HTTP Signatures
- Inbox/Outbox
- 配送システム（Job Queue）

**完了条件:**
- Mastodon/Misskeyと連合成功
- 全ActivityPubアクティビティ対応
- 配送成功率95%以上

## アーキテクチャ概要

### モノレポ構造

```
rox/
├── packages/
│   ├── backend/          # Hono Rox (APIサーバー)
│   │   ├── src/
│   │   │   ├── adapters/      # インフラ実装
│   │   │   ├── db/            # データベース層
│   │   │   ├── interfaces/    # 抽象定義
│   │   │   ├── repositories/  # Repository実装
│   │   │   ├── services/      # ビジネスロジック
│   │   │   ├── routes/        # Honoエンドポイント
│   │   │   └── index.ts       # エントリーポイント
│   │   └── drizzle/           # マイグレーション
│   ├── frontend/         # Waku Rox (Webクライアント)
│   │   └── src/
│   │       ├── app/           # Wakuルート
│   │       ├── components/    # Reactコンポーネント
│   │       ├── lib/           # ユーティリティ
│   │       └── styles/        # スタイル
│   └── shared/           # 共通コード
│       └── src/
│           ├── types/         # 型定義
│           └── utils/         # ユーティリティ
├── docs/                 # ドキュメント
├── docker/               # Docker設定
└── scripts/              # ビルド・デプロイスクリプト
```

### データフロー

#### リクエスト処理フロー

```
Client Request
    ↓
Hono Middleware (DI)
    ↓
Controller (routes/)
    ↓
Service (services/) ← ビジネスロジック
    ↓
Repository (repositories/) ← データ永続化
    ↓
Database / Storage Adapter
    ↓
Infrastructure (PostgreSQL, S3, etc.)
```

#### 依存関係の方向

```
routes/ → services/ → repositories/ → db/
                    ↘ adapters/ → storage/

※ 全ての依存は抽象（インターフェース）に向く
※ 具体実装は起動時にDIコンテナで注入
```

## 並行作業の可能性

### Phase 0完了後

- ✅ データベース実装を順次追加（PostgreSQL → MySQL → SQLite/D1）
- ✅ ストレージアダプター追加（Local → S3）

### Phase 1完了後

- ✅ **Phase 2 (Frontend)** と **Phase 3 (Federation)** は独立しているため並行可能
- ⚠️ ただし、リソースが限られる場合はPhase 2を優先推奨（ユーザー体験向上）

## 品質保証

### テスト戦略

- **Unit Tests**: 全Repository、Service、Adapter
- **Integration Tests**: APIエンドポイント（テストDB使用）
- **E2E Tests**: 主要ユーザーフロー

### カバレッジ目標

- 全体: 80%以上
- ビジネスロジック（services/）: 90%以上

### CI/CD

- Linting & Formatting (oxc)
- Type Checking (tsc)
- Unit & Integration Tests
- Build Verification

## デプロイメント

### VPS環境（推奨）

- Docker Compose使用
- PostgreSQL + Redis + Backend + Frontend
- Nginx/Caddy でリバースプロキシ

### Edge環境（Cloudflare）

- Cloudflare Workers（Backend）
- Cloudflare D1（Database）
- Cloudflare R2（Storage）
- Cloudflare Pages（Frontend）

## リスク管理

### 高リスク項目

1. **データベース抽象化の複雑性**
   - 対策: PostgreSQLを優先、他は後回し可能

2. **ActivityPub互換性**
   - 対策: 早期に実サーバーとテスト、既存実装を参考

3. **スケーラビリティ**
   - 対策: インデックス最適化、キャッシュ層導入検討

### 中リスク項目

1. **Waku/RSCの成熟度**
   - 対策: Waku公式例を参考、問題あればNext.jsへの切り替え検討

2. **エッジ環境の制約**
   - 対策: VPS版を優先開発、Edge版は後付け

## 次のステップ

1. [Phase 0 実装計画](./phase-0-foundation.md)を確認
2. [重要な決定事項](./decisions.md)を確認
3. 実装開始

## 参考資料

- [プロジェクト仕様書（日本語）](../project/v1.md)
- [開発者ガイド](../../CLAUDE.md)
- [ActivityPub仕様](https://www.w3.org/TR/activitypub/)
- [Misskey API仕様](https://misskey-hub.net/docs/api/)
