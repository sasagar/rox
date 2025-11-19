# Rox Implementation Plan

このディレクトリには、Roxプロジェクトの実装計画と進捗管理に関するドキュメントが含まれています。

## ドキュメント構成

- [overview.md](./overview.md) - プロジェクト全体の概要と実装アプローチ
- [phase-0-foundation.md](./phase-0-foundation.md) - フェーズ0: 基盤構築
- [phase-1-api.md](./phase-1-api.md) - フェーズ1: Misskey互換API実装
- [phase-2-frontend.md](./phase-2-frontend.md) - フェーズ2: フロントエンド実装
- [phase-3-federation.md](./phase-3-federation.md) - フェーズ3: ActivityPub連合
- [decisions.md](./decisions.md) - 重要な技術的決定事項
- [timeline.md](./timeline.md) - 実装タイムラインとマイルストーン

## 実装状況

| フェーズ | ステータス | 完了率 | 備考 |
|---------|----------|--------|------|
| Phase 0: Foundation | ✅ 完了 | 100% | 全ての基盤コンポーネント実装・テスト完了 |
| Phase 1: Misskey API | 🔄 進行中 | 30% | 認証システム完了、ノート機能は未着手 |
| Phase 2: Frontend | ⏳ 未着手 | 0% | Phase 1完了後に開始 |
| Phase 3: Federation | ⏳ 未着手 | 0% | Phase 1完了後に開始可能 |

## 直近の実装内容

### Phase 0 (完了)
- ✅ Bunワークスペース・モノレポ構造
- ✅ TypeScript strict mode設定
- ✅ oxc設定（リント・フォーマット）
- ✅ Docker Compose（PostgreSQL/Redis）
- ✅ Drizzle ORMスキーマ定義（6テーブル）
- ✅ Repository Pattern実装（6リポジトリ）
- ✅ Storage Adapter Pattern実装（Local/S3）
- ✅ DIコンテナとミドルウェア
- ✅ データベースマイグレーション

### Phase 1 (進行中)
- ✅ パスワードハッシュユーティリティ（Argon2id）
- ✅ セッション管理ユーティリティ
- ✅ 認証サービス（登録・ログイン・ログアウト）
- ✅ 認証ミドルウェア（optionalAuth/requireAuth）
- ✅ ユーザーAPIルート（登録・取得・更新）
- ✅ 認証APIルート（ログイン・ログアウト・セッション検証）
- ✅ 全機能のテスト完了
- ⏳ ノート投稿機能（未着手）
- ⏳ タイムライン機能（未着手）
- ⏳ リアクション機能（未着手）
- ⏳ ファイルアップロード機能（未着手）

## クイックリンク

- [プロジェクト仕様書](../project/v1.md)
- [開発者ガイド](../../CLAUDE.md)
- [セットアップ手順](../../README.md)

## 進捗更新

このドキュメントは実装の進行に合わせて更新されます。

**最終更新:** 2025-11-19
**現在のフェーズ:** Phase 1 (Misskey API - 認証システム完了)
**次のマイルストーン:** ノート投稿機能の実装
