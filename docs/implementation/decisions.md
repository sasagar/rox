# 技術的決定事項

このドキュメントでは、Roxプロジェクトにおける重要な技術的決定とその理由を記録します。

## データベース

### 決定: マルチDB対応（PostgreSQL / MySQL / SQLite/D1）

**選択肢:**
1. PostgreSQL のみ
2. マルチDB対応

**決定:** マルチDB対応を採用

**理由:**
- Infrastructure Agnosticの原則に従う
- エッジ環境（Cloudflare D1）への対応
- ユーザーが既存のインフラを活用しやすい
- Repository Patternで実装コストは管理可能

**実装優先度:**
1. PostgreSQL（優先・Phase 0で実装）
2. SQLite/D1（Phase 0完了後に追加）
3. MySQL（Phase 0完了後に追加、優先度低）

---

## 認証

### 決定: トークンベース認証（不透明トークン）

**選択肢:**
1. JWT（JSON Web Token）
2. 不透明トークン + データベース保存

**決定:** 不透明トークン + データベース保存

**理由:**
- セッション無効化が即座に可能
- トークンローテーションが容易
- デバイス管理が可能
- JWTのペイロード露出リスクを回避

**設定:**
- セッション有効期限: 30日
- リフレッシュ: 自動延長（アクセス時に有効期限更新）
- マルチデバイス: 対応（1ユーザーあたり複数セッション可）

### 決定: パスワードハッシュアルゴリズム

**選択: Argon2**

**理由:**
- bcryptより安全（メモリハード関数）
- Password Hashing Competition優勝
- ブルートフォース攻撃に強い

**実装:**
- ライブラリ: `@node-rs/argon2`（ネイティブバインディング、高速）

---

## ファイル管理

### 決定: 最大ファイルサイズ

**設定:** 10MB（デフォルト、環境変数で変更可能）

**理由:**
- 大半のユースケースをカバー
- サーバー負荷を抑制
- 必要に応じて環境変数で調整可能

### 決定: 1投稿あたりの最大ファイル数

**設定:** 4個

**理由:**
- Misskeyの仕様に準拠
- UI/UXのバランス
- データベース負荷の制御

### 決定: WebP変換

**設定:** オプション（環境変数 `ENABLE_WEBP_CONVERSION`）

**理由:**
- 帯域節約とユーザー体験向上のメリット
- しかし、変換処理はCPU負荷が高い
- ユーザーの選択に委ねる

**実装:**
- デフォルト: false（変換しない）
- true の場合: Sharp ライブラリで変換

### 決定: サムネイル生成

**設定:** 常に生成（画像のみ）

**理由:**
- タイムライン表示の高速化
- 帯域節約
- Sharp ライブラリで高速処理可能

**サムネイルサイズ:** 400x400px（最大、アスペクト比維持）

---

## キュー・キャッシュ

### 決定: Dragonfly（Redis互換）

**選択肢:**
1. Redis
2. Dragonfly
3. KeyDB

**決定:** Dragonfly

**理由:**
- Redis完全互換（既存のRedisクライアント・ツールがそのまま使える）
- メモリ効率が高い（最大25倍効率的、メーカー公称値）
- マルチスレッド対応でパフォーマンスが高い
- 軽量でリソース消費が少ない
- アクティブに開発・メンテナンスされている

**用途:**
- BullMQジョブキュー（ActivityPub配送など）
- セッションキャッシュ（将来的に）
- Pub/Sub（リアルタイム通知、Phase 3以降）

**設定:**
- ポート: 6379（Redisと同じデフォルトポート）
- データ永続化: ボリュームマウント（/data）
- ヘルスチェック: redis-cli ping

---

## ストレージ

### 決定: マルチストレージ対応

**対応ストレージ:**
1. Local Filesystem（開発・単一サーバー）
2. S3互換ストレージ（本番・スケール）

**理由:**
- 開発環境の簡便性（ローカル）
- 本番環境のスケーラビリティ（S3/R2）
- Adapter Patternで切り替え容易

### 決定: CDN戦略

**設定:** S3/R2のPublic URL直接利用

**理由:**
- シンプルな実装
- CDNはS3/R2側で設定可能
- 必要に応じてCloudflare Workers等でプロキシ追加可能

---

## 連合（ActivityPub）

### 決定: 配送リトライ回数

**設定:** 3回（1分後、5分後、30分後）

**理由:**
- 一時的なネットワーク障害に対応
- 過度なリトライでリソース浪費を避ける
- Mastodon等の実装を参考

### 決定: Shared Inbox対応

**設定:** 常に利用（可能な場合）

**理由:**
- 配送効率の向上（1サーバーあたり1リクエスト）
- 帯域・CPU負荷の削減
- ActivityPub仕様の推奨事項

### 決定: メディアプロキシ

**設定:** Phase 3では直接リンク、Phase 4以降でプロキシ実装検討

**理由:**
- 実装の簡略化
- リモートサーバーの負荷分散は後回し
- 必要性が明確になってから実装

### 決定: インスタンスブロック管理

**設定:** Phase 3ではマニュアル（環境変数）、Phase 4以降でUI実装

**理由:**
- 初期段階では管理者が手動設定
- 需要が明確になってから管理UIを実装

---

## リアルタイム更新

### 決定: ポーリング → WebSocket（段階的移行）

**Phase 1-2:** ポーリング（30秒間隔）

**理由:**
- 実装がシンプル
- サーバー接続数の管理が不要
- 初期段階で十分

**Phase 3以降:** WebSocket追加

**理由:**
- リアルタイム性の向上
- 帯域節約
- スケーラビリティは Dragonfly Pub/Sub で対応

**実装予定:**
- Socket.IO または Hono WebSocket
- Dragonfly Pub/Sub でサーバー間通信（Redis互換API）

---

## ID生成

### 決定: カスタムID生成（timestamp + random）

**フォーマット:** `{timestamp(base36)}{random(base36)}`

**選択肢:**
1. UUID v4
2. ULID
3. カスタムID

**決定:** カスタムID

**理由:**
- 時系列順序を保証
- UUIDより短い
- ULIDのようなライブラリ依存なし
- Misskeyの aid/aidx に類似

**実装:**
```typescript
const timestamp = Date.now().toString(36);
const random = Math.random().toString(36).substring(2, 10);
return `${timestamp}${random}`;
```

---

## フロントエンド

### 決定: Waku + React Server Components

**選択肢:**
1. Next.js App Router
2. Waku
3. Remix

**決定:** Waku

**理由:**
- RSCネイティブサポート
- 最小構成（軽量）
- 学習コスト低
- カスタマイズ性高

**リスク対策:**
- Wakuが成熟していない場合、Next.js App Routerへ移行可能
- RSCの概念は共通

### 決定: 状態管理（Jotai）

**選択肢:**
1. Zustand
2. Jotai
3. React Context

**決定:** Jotai

**理由:**
- アトミックな状態管理
- 再レンダリング最小化
- Wakuとの親和性
- シンプルなAPI

### 決定: スタイリング（Tailwind CSS）

**選択肢:**
1. CSS Modules
2. Styled Components
3. Tailwind CSS

**決定:** Tailwind CSS

**理由:**
- ビルド時最適化
- ユーティリティファーストで開発速度向上
- 一貫したデザインシステム
- コミュニティサポート

---

## テスト

### 決定: テストランナー（Bun Test）

**理由:**
- Bunネイティブ
- 高速
- TypeScript対応
- Jest互換API

### 決定: カバレッジ目標

**設定:**
- 全体: 80%以上
- ビジネスロジック（services/）: 90%以上

**理由:**
- 品質担保とメンテナンス性のバランス
- 100%は非現実的かつコスト高

---

## CI/CD

### 決定: GitHub Actions

**理由:**
- GitHub統合
- 無料枠が十分
- コミュニティサポート

**パイプライン:**
1. Lint & Format（oxc）
2. Type Check（tsc）
3. Test（bun test）
4. Build Verification

---

## 開発環境

### 決定: Docker Compose v2形式

**変更内容:**
- ファイル名: `docker-compose.yml` → `compose.yml`
- `version` フィールド削除（v2では不要）
- コマンド: `docker-compose` → `docker compose`（ハイフンなし）

**理由:**
- Docker Compose v2の推奨フォーマット
- Docker CLIとの統合（docker composeがネイティブサブコマンド）
- 将来的な互換性の確保

**compose.yml構成:**
- **postgres**: PostgreSQL 16（メインデータベース）
- **dragonfly**: Dragonfly latest（キュー・キャッシュ）
- **mysql**: MySQL 8（オプション、`--profile mysql`で起動）

**注意事項:**
- docker-compose（v1、Python版）は非推奨
- docker compose（v2、Go版）の使用を推奨
- 既存のdocker-compose.ymlは削除済み

---

## デプロイメント

### 決定: 複数デプロイメントオプション提供

**サポート環境:**

1. **VPS / Dedicated Server（推奨）**
   - Docker Compose
   - PostgreSQL + Dragonfly + Backend + Frontend
   - Nginx/Caddy リバースプロキシ

2. **Cloudflare（Edge）**
   - Cloudflare Workers（Backend）
   - Cloudflare D1（Database）
   - Cloudflare R2（Storage）
   - Cloudflare Pages（Frontend）

**理由:**
- ユーザーの選択肢を広げる
- Infrastructure Agnosticの実現

**優先度:**
1. VPS（Phase 0-3で完全対応）
2. Cloudflare（Phase 3完了後にドキュメント整備）

---

## コード品質

### 決定: oxc（Linter + Formatter）

**選択肢:**
1. ESLint + Prettier
2. Biome
3. oxc

**決定:** oxc

**理由:**
- Rust製で高速
- ESLint + Prettierを1ツールで代替
- Bunとの親和性
- 設定がシンプル

---

## 決定事項の変更プロセス

このドキュメントの決定事項は、以下の条件で変更可能:

1. **技術的な理由:**
   - 選択した技術に致命的な問題が発見された場合
   - より良い代替案が登場した場合

2. **変更プロセス:**
   - Issue作成して議論
   - このドキュメントを更新
   - 影響範囲を明記

3. **記録:**
   - 変更履歴をこのドキュメント末尾に記載

---

## 変更履歴

| 日付 | 項目 | 変更内容 | 理由 |
|------|------|---------|------|
| 2025-11-19 | - | 初版作成 | - |
| 2025-11-19 | Docker構成 | RedisをDragonflyに変更、docker-compose.yml→compose.ymlにリネーム | Dragonflyの方がRedis互換でより軽量。Docker Compose v2の推奨フォーマットに準拠 |
| 2025-11-19 | ドキュメント | CLAUDE.mdへの参照を削除、docs/implementation/への参照に変更 | CLAUDE.mdはAI専用ファイルで人間向けドキュメントではないため |

---

## 未決定事項

以下の項目は、実装の進行に伴い決定予定:

### Phase 1以降で決定

- [ ] **カスタム絵文字の実装方法**
  - 選択肢: Database保存 vs ファイルシステム
  - 決定時期: Phase 1 Week 3

- [ ] **通知システムの実装方法**
  - 選択肢: ポーリング vs WebSocket vs Server-Sent Events
  - 決定時期: Phase 2 Week 3

### Phase 3以降で決定

- [ ] **連合タイムラインのフィルタリング戦略**
  - NSFW、センシティブコンテンツの扱い
  - 決定時期: Phase 3 Week 2

- [ ] **モデレーション機能の範囲**
  - ユーザー/インスタンスブロック
  - レポート機能
  - 決定時期: Phase 3 Week 5
