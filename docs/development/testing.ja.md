# テストガイド

**言語**: [English](./testing.md) | 日本語

Roxのテスト実行と作成に関する包括的なガイド。

## 概要

Roxはすべてのテストに [Bunの組み込みテストランナー](https://bun.sh/docs/cli/test) を使用しています。テストは3つのカテゴリに分類されます：

- **ユニットテスト**: 個々の関数やクラスを分離してテスト
- **インテグレーションテスト**: APIエンドポイントとサービス間の連携をテスト
- **E2Eテスト**: 完全なActivityPub連合フローをテスト

## 開発環境

### DevContainerを使用（推奨）

テストを実行する最も簡単な方法は、必要なサービスがすべて揃った [DevContainer](./devcontainer.ja.md) 内で行うことです：

1. VS Code/Cursorでプロジェクトを開く
2. コンテナで再度開く
3. `bun test` でテストを実行

すべてのデータベースサービス（PostgreSQL、MariaDB、Dragonfly）が自動的に利用可能です。

### ローカル開発

DevContainerを使用しない場合は、サービスを手動で起動します：

```bash
# 開発サービスを起動
docker compose -f docker/compose.dev.yml up -d

# サービスの準備が整うまで待機
until pg_isready -h localhost -U rox -d rox; do sleep 1; done

# テストを実行
bun test
```

## テスト構造

```
packages/backend/src/tests/
├── unit/                    # ユニットテスト
│   ├── AuthService.test.ts
│   ├── NoteService.test.ts
│   ├── UserService.test.ts
│   ├── FollowService.test.ts
│   ├── ReactionService.test.ts
│   ├── ImageProcessor.test.ts
│   ├── InboxService.test.ts
│   ├── ActivityDeliveryQueue.test.ts
│   └── inbox-handlers/      # ActivityPub inboxハンドラーテスト
│       ├── FollowHandler.test.ts
│       ├── CreateHandler.test.ts
│       ├── LikeHandler.test.ts
│       ├── AnnounceHandler.test.ts
│       ├── DeleteHandler.test.ts
│       ├── UndoHandler.test.ts
│       └── AcceptRejectHandler.test.ts
├── integration/             # インテグレーションテスト
│   └── api-endpoints.test.ts
└── e2e/                     # エンドツーエンドテスト
    └── activitypub-federation.test.ts
```

## テストの実行

### すべてのテストを実行

```bash
bun test
```

### カバレッジ付きでテスト実行

```bash
bun test --coverage
```

### 特定のテストファイルを実行

```bash
bun test packages/backend/src/tests/unit/NoteService.test.ts
```

### パターンに一致するテストを実行

```bash
# すべてのユニットテストを実行
bun test --filter "unit"

# inboxハンドラーテストを実行
bun test --filter "inbox-handlers"

# 名前で特定のテストを実行
bun test --filter "should create a note"
```

### ウォッチモード

```bash
bun test --watch
```

## テストの書き方

### ユニットテストの例

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NoteService } from '../../services/NoteService';

describe('NoteService', () => {
  let noteService: NoteService;
  let mockNoteRepository: any;
  let mockUserRepository: any;

  beforeEach(() => {
    // モックリポジトリの作成
    mockNoteRepository = {
      create: mock(() => Promise.resolve({ id: 'note-123' })),
      findById: mock(() => Promise.resolve(null)),
    };
    mockUserRepository = {
      findById: mock(() => Promise.resolve({ id: 'user-123', username: 'test' })),
    };

    noteService = new NoteService(mockNoteRepository, mockUserRepository);
  });

  describe('createNote', () => {
    it('有効な入力でノートを作成する', async () => {
      const result = await noteService.create({
        text: 'Hello, world!',
        userId: 'user-123',
        visibility: 'public',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('note-123');
      expect(mockNoteRepository.create).toHaveBeenCalledTimes(1);
    });

    it('空のテキストでエラーをスローする', async () => {
      await expect(
        noteService.create({
          text: '',
          userId: 'user-123',
          visibility: 'public',
        })
      ).rejects.toThrow();
    });
  });
});
```

### インテグレーションテストの例

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../../app';

describe('APIエンドポイント', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp();
  });

  describe('GET /api/notes/local-timeline', () => {
    it('公開ノートを返す', async () => {
      const response = await app.request('/api/notes/local-timeline', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('limitパラメータを尊重する', async () => {
      const response = await app.request('/api/notes/local-timeline?limit=5', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBeLessThanOrEqual(5);
    });
  });
});
```

### モッキングのベストプラクティス

```typescript
import { mock, spyOn } from 'bun:test';

// 関数をモック
const mockFn = mock(() => 'mocked value');

// 既存のメソッドをスパイ
const spy = spyOn(object, 'method');

// モジュールをモック（インポート前に作成）
mock.module('../../lib/someModule', () => ({
  someFunction: mock(() => 'mocked'),
}));

// テスト間でモックをリセット
beforeEach(() => {
  mockFn.mockClear();
});
```

## テストカテゴリ

### ユニットテスト

ユニットテストは個々のコンポーネントを分離してテストします：

| テストファイル | カバー範囲 |
|---------------|-----------|
| `AuthService.test.ts` | 認証、トークン生成、パスワードハッシュ |
| `NoteService.test.ts` | ノートCRUD、公開範囲、メンション |
| `UserService.test.ts` | ユーザープロファイル、キャッシング、ルックアップ |
| `FollowService.test.ts` | フォロー/アンフォロー、フォロワー数 |
| `ReactionService.test.ts` | 絵文字リアクション、カウント |
| `ImageProcessor.test.ts` | 画像リサイズ、WebP変換 |
| `InboxService.test.ts` | ActivityPub inbox処理 |
| `ActivityDeliveryQueue.test.ts` | ジョブキュー、レート制限、メトリクス |

### Inboxハンドラーテスト

ActivityPub inboxハンドラーには専用のテストがあります：

| ハンドラー | テスト対象のアクティビティ |
|----------|--------------------------|
| `FollowHandler` | フォローリクエスト |
| `CreateHandler` | リモートからのノート作成 |
| `LikeHandler` | いいね/お気に入りアクティビティ |
| `AnnounceHandler` | ブースト/リノートアクティビティ |
| `DeleteHandler` | ノートとアクターの削除 |
| `UndoHandler` | Undo Follow、Like、Announce |
| `AcceptRejectHandler` | フォロー承認/拒否 |

### インテグレーションテスト

インテグレーションテストはAPIエンドポイントが正しく動作することを検証します：

- 認証エンドポイント (`/api/auth/*`)
- ノートエンドポイント (`/api/notes/*`)
- ユーザーエンドポイント (`/api/users/*`)
- タイムラインエンドポイント
- ファイルアップロードエンドポイント

### E2Eテスト

エンドツーエンドテストは他のActivityPubサーバーとの連合を検証します：

- WebFinger解決
- Actor取得
- アクティビティ配信
- Inbox処理
- HTTP署名検証

## 環境設定

### テスト用データベース

テストは開発と同じデータベース設定を使用します：

```bash
# 必要な環境変数
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
```

**DevContainer内**では、これらは事前設定されています。データベースホストは `localhost` ではなく `postgres` です：

```bash
DATABASE_URL=postgresql://rox:rox_dev_password@postgres:5432/rox
```

### テストデータベースで実行

分離されたテスト実行には、別のデータベースを使用できます：

```bash
# ローカル開発
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox_test bun test

# DevContainer内
DATABASE_URL=postgresql://rox:rox_dev_password@postgres:5432/rox_test bun test
```

### MariaDBでテスト

DevContainerにはMySQL互換性テスト用のMariaDBが含まれています：

```bash
# MariaDBに切り替え
DB_TYPE=mysql
DATABASE_URL=mysql://rox:rox_dev_password@mariadb:3306/rox bun test
```

## 継続的インテグレーション

**ユニットテスト**は以下の際に自動実行されます：

- プルリクエストの作成/更新
- mainブランチへのプッシュ

GitHub Actionsワークフローで実行される内容：
1. `lint-and-typecheck` - リントとTypeScriptチェック
2. `unit-tests` - すべてのユニットテスト（180+テスト）
3. `build` - バックエンドとフロントエンドのビルド

```yaml
- name: ユニットテストを実行
  run: bun test src/tests/unit/
  working-directory: packages/backend
```

### インテグレーション＆E2Eテスト

インテグレーションとE2Eテストは実行中のサーバーが必要で、**CIでは実行されません**。
開発またはステージング環境で手動実行してください：

```bash
# 1. サーバーを起動
bun run dev

# 2. 別のターミナルでインテグレーションテストを実行
bun test src/tests/integration/

# 3. E2Eテストを実行
bun test src/tests/e2e/
```

## テストカバレッジ目標

| カテゴリ | 目標 | 現在 |
|---------|------|------|
| ユニットテスト | 80% | 約75% |
| インテグレーションテスト | 70% | 約65% |
| E2Eテスト | 50% | 約40% |

## テストのデバッグ

### 詳細出力

```bash
bun test --verbose
```

### 単一テストを実行

```bash
bun test --filter "正確なテスト名"
```

### ブレークポイントでデバッグ

```typescript
// テストにdebugger文を追加
it('何かをすべき', async () => {
  debugger; // ここで実行が一時停止
  const result = await someFunction();
  expect(result).toBeDefined();
});
```

その後実行：

```bash
bun test --inspect-brk
```

## よくある問題

### テストがタイムアウトする

遅いテストにはタイムアウトを増加：

```typescript
it('遅い操作を処理する', async () => {
  // テストコード
}, 30000); // 30秒タイムアウト
```

### データベース状態の競合

テスト分離のためにトランザクションを使用：

```typescript
beforeEach(async () => {
  await db.transaction(async (tx) => {
    // テストデータのセットアップ
  });
});

afterEach(async () => {
  // テストデータのクリーンアップ
});
```

### モックが動作しない

モックはテスト対象のモジュールをインポートする前に作成してください：

```typescript
// 間違い - モジュールが既にインポートされている
import { someFunction } from './module';
mock.module('./module', () => ({}));

// 正しい - インポート前にモック
mock.module('./module', () => ({}));
import { someFunction } from './module';
```

## 関連ドキュメント

- [DevContainerガイド](./devcontainer.ja.md) - 開発環境のセットアップ
- [CLAUDE.md](../../CLAUDE.md) - プロジェクトガイドラインとコマンド
- [デプロイガイド](../deployment/vps-docker.md) - 本番デプロイ
