# Rox Implementation Plan

このディレクトリには、Roxプロジェクトの実装計画と進捗管理に関するドキュメントが含まれています。

**言語**: [English](./README.en.md) | 日本語

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
| Phase 1: Misskey API | ✅ 完了 | 100% | 全コアエンドポイント実装・動作確認完了 |
| Phase 2: Frontend | ✅ 完了 | 100% | Waku Client完全実装（アクセシビリティ対応含む） |
| Phase 3: Federation | ✅ 完了 | 100% | ActivityPub連合機能実装済み |
| Phase 4: Refactoring | ✅ 完了 | 100% | コード最適化・テストカバレッジ向上 |
| Phase 5: Administration | ✅ 完了 | 100% | ロールシステム・モデレーションツール |
| Phase 6: Production | ✅ 完了 | 100% | 本番環境デプロイ準備完了 |

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

### Phase 1 (完了 - 2025-11-19)

**認証・セッション管理:**
- ✅ パスワードハッシュユーティリティ（Argon2id）
- ✅ セッション管理ユーティリティ（CSPRNG）
- ✅ 認証サービス（登録・ログイン・ログアウト・セッション検証）
- ✅ 認証ミドルウェア（optionalAuth/requireAuth）
- ✅ ユーザー登録・ログイン・ログアウトAPIエンドポイント

**ユーザー管理:**
- ✅ プロフィール取得・更新（/api/users/@me, PATCH /api/users/@me）
- ✅ ユーザー情報取得（/api/users/:id）
- ✅ Misskey互換エンドポイント（/api/users/show?userId/username）
- ✅ フォロー・アンフォロー機能
- ✅ フォロワー・フォロイング一覧（ページネーション対応）

**ファイル管理:**
- ✅ ファイルアップロード・削除・更新（/api/drive/files/*）
- ✅ ストレージ使用量計算（/api/drive/usage）
- ✅ メタデータ管理（isSensitive, comment）
- ✅ MD5ハッシュ計算

**ノート機能:**
- ✅ ノート作成・取得・削除
- ✅ タイムライン（ローカル・ホーム・ユーザー）
- ✅ ファイル添付（最大4ファイル/ノート）
- ✅ メンション・ハッシュタグ・絵文字抽出
- ✅ リプライ・Renote対応
- ✅ Visibility制御（public/home/followers/specified）

**リアクション:**
- ✅ リアクション作成・削除
- ✅ リアクション集計・一覧取得
- ✅ Unicode絵文字・カスタム絵文字対応

## クイックリンク

- [プロジェクト仕様書](../project/v1.md)
- [開発者ガイド](../../CLAUDE.md)
- [セットアップ手順](../../README.md)

## 進捗更新

このドキュメントは実装の進行に合わせて更新されます。

**最終更新:** 2025-12-02
**現在のフェーズ:** Phase 6 完了 ✅
**次のマイルストーン:** Phase 7 (Plugin System) - 計画中

## アーカイブ

過去のタスクサマリーや計画ドキュメントは [archive](./archive/) ディレクトリで参照できます。
