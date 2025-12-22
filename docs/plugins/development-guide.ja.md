# Rox プラグイン開発ガイド

このガイドでは、Roxのプラグインを作成する方法を説明します。プラグインはバックエンドとフロントエンドの両方の機能を拡張できます。

## 目次

- [クイックスタート](#クイックスタート)
- [プラグイン構造](#プラグイン構造)
- [プラグインマニフェスト](#プラグインマニフェスト)
- [バックエンドプラグイン](#バックエンドプラグイン)
  - [プラグインコンテキスト](#プラグインコンテキスト)
  - [イベントシステム](#イベントシステム)
  - [カスタムルート](#カスタムルート)
  - [スケジュールタスク](#スケジュールタスク)
  - [設定ストレージ](#設定ストレージ)
- [パーミッション](#パーミッション)
- [フロントエンドプラグイン](#フロントエンドプラグイン)
- [ベストプラクティス](#ベストプラクティス)
- [サンプル](#サンプル)

## クイックスタート

1. プラグインディレクトリを作成:

```bash
mkdir my-plugin
cd my-plugin
```

2. `plugin.json` マニフェストを作成:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "サンプルRoxプラグイン",
  "author": "Your Name",
  "minRoxVersion": "2025.12.0",
  "permissions": ["note:read", "config:read", "config:write"],
  "backend": "index.ts"
}
```

3. `index.ts` を作成:

```typescript
import type { RoxPlugin } from "rox/plugins";

const myPlugin: RoxPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",

  onLoad({ events, logger, config }) {
    logger.info("プラグインがロードされました！");

    events.on("note:afterCreate", ({ note }) => {
      logger.info({ noteId: note.id }, "新しいノートが作成されました");
    });
  },

  onUnload() {
    // クリーンアップ（オプション）
  },
};

export default myPlugin;
```

4. プラグインをインストール:

```bash
bun run plugin install ./my-plugin
```

## プラグイン構造

一般的なプラグインのディレクトリ構造:

```
my-plugin/
├── plugin.json          # 必須: プラグインマニフェスト
├── index.ts             # バックエンドエントリーポイント
├── frontend/            # オプション: フロントエンドコンポーネント
│   └── index.tsx
├── README.md            # ドキュメント
└── LICENSE              # ライセンスファイル
```

## プラグインマニフェスト

`plugin.json` ファイルでプラグインを定義します:

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `id` | string | はい | 一意の識別子（小文字、英数字、ハイフン） |
| `name` | string | はい | 人間が読める名前 |
| `version` | string | はい | セマンティックバージョン（例: "1.0.0"） |
| `description` | string | いいえ | 短い説明 |
| `author` | string | いいえ | 作者名または組織 |
| `repository` | string | いいえ | リポジトリURL |
| `minRoxVersion` | string | いいえ | 必要な最小Roxバージョン |
| `dependencies` | string[] | いいえ | 先にロードが必要な他のプラグインID |
| `permissions` | string[] | いいえ | 必要なパーミッション（[パーミッション](#パーミッション)を参照） |
| `backend` | string | いいえ | バックエンドエントリーポイントへのパス |
| `frontend` | string | いいえ | フロントエンドエントリーポイントへのパス |
| `configSchema` | object | いいえ | 設定のJSON Schema |

### マニフェストの例

```json
{
  "id": "content-filter",
  "name": "Content Filter",
  "version": "1.2.0",
  "description": "キーワードに基づいてノートをフィルタリング",
  "author": "Rox Community",
  "repository": "https://github.com/example/content-filter",
  "minRoxVersion": "2025.12.0",
  "dependencies": [],
  "permissions": [
    "note:read",
    "note:write",
    "config:read",
    "config:write"
  ],
  "backend": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {
      "keywords": {
        "type": "array",
        "items": { "type": "string" },
        "description": "フィルタリングするキーワード"
      },
      "action": {
        "type": "string",
        "enum": ["warn", "hide", "block"],
        "default": "warn"
      }
    }
  }
}
```

## バックエンドプラグイン

### プラグインコンテキスト

`onLoad` 関数は以下のプロパティを持つ `PluginContext` を受け取ります:

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `events` | IEventBus | ライフサイクルイベントを購読するためのイベントバス |
| `logger` | pino.Logger | プラグイン用の名前空間付きロガー |
| `config` | PluginConfigStorage | プラグイン固有の設定ストレージ |
| `baseUrl` | string | RoxインスタンスのベースURL |
| `roxVersion` | string | 現在のRoxバージョン |
| `registerScheduledTask` | function | スケジュールタスクを登録する関数 |

### イベントシステム

RoxはプラグインとのコミュニケーションにEventBusを使用します。イベントは `{リソース}:{タイミング}{アクション}` のパターンに従います。

#### 利用可能なイベント

| イベント | タイプ | 説明 |
|---------|--------|------|
| `note:beforeCreate` | Before | ノート作成前（キャンセル/修正可能） |
| `note:afterCreate` | After | ノート作成後（通知のみ） |
| `note:beforeDelete` | Before | ノート削除前（キャンセル可能） |
| `note:afterDelete` | After | ノート削除後（通知のみ） |
| `user:beforeRegister` | Before | ユーザー登録前（キャンセル/修正可能） |
| `user:afterRegister` | After | ユーザー登録後（通知のみ） |

#### イベントの購読

**Afterイベント**（通知のみ）:

```typescript
events.on("note:afterCreate", ({ note }) => {
  logger.info({ noteId: note.id }, "ノートが作成されました");
});
```

**Beforeイベント**（キャンセルまたは修正可能）:

```typescript
events.onBefore("note:beforeCreate", async ({ content, userId }) => {
  // コンテンツをチェック
  if (containsBannedWords(content)) {
    return { cancel: true, reason: "禁止ワードが含まれています" };
  }

  // コンテンツを修正
  const sanitized = sanitizeContent(content);
  if (sanitized !== content) {
    return { modified: { content: sanitized, userId } };
  }

  // 変更なしで許可
  return {};
});
```

#### イベントデータ型

**note:beforeCreate**
```typescript
interface NoteBeforeCreateData {
  content: string;
  userId: string;
  cw?: string | null;
  visibility?: "public" | "home" | "followers" | "specified";
  localOnly?: boolean;
}
```

**note:afterCreate**
```typescript
interface NoteAfterCreateData {
  note: Note;  // 完全なNoteオブジェクト
}
```

**note:beforeDelete / note:afterDelete**
```typescript
interface NoteDeleteData {
  noteId: string;
  userId: string;
}
```

**user:beforeRegister**
```typescript
interface UserBeforeRegisterData {
  username: string;
  email?: string | null;
}
```

**user:afterRegister**
```typescript
interface UserAfterRegisterData {
  userId: string;
  username: string;
}
```

### カスタムルート

プラグインは `/api/x/{pluginId}/` 配下にカスタムAPIルートを登録できます:

```typescript
const myPlugin: RoxPlugin = {
  id: "my-plugin",
  // ...

  routes(app) {
    // GET /api/x/my-plugin/status
    app.get("/status", (c) => {
      return c.json({ status: "ok" });
    });

    // POST /api/x/my-plugin/action
    app.post("/action", async (c) => {
      const body = await c.req.json();
      // リクエストを処理
      return c.json({ success: true });
    });
  },
};
```

### スケジュールタスク

スケジュールで実行されるタスクを登録:

```typescript
onLoad({ registerScheduledTask, logger }) {
  registerScheduledTask({
    id: "cleanup-task",
    name: "古いデータのクリーンアップ",
    schedule: "1h",  // 1時間ごとに実行
    runOnStartup: true,
    async handler() {
      logger.info("クリーンアップを実行中...");
      // クリーンアップを実行
    },
  });
}
```

**スケジュール形式:**
- `"30s"` - 30秒ごと
- `"5m"` - 5分ごと
- `"1h"` - 1時間ごと
- `"24h"` - 24時間ごと

### 設定ストレージ

プラグイン固有の設定を保存・取得:

```typescript
onLoad({ config, logger }) {
  // 設定を読み取り
  const keywords = await config.get<string[]>("keywords") ?? [];

  // 設定を書き込み
  await config.set("keywords", ["nsfw", "spoiler"]);

  // 設定を削除
  await config.delete("oldKey");

  // すべての設定を取得
  const allConfig = await config.getAll();
}
```

## パーミッション

プラグインはマニフェストで必要なパーミッションを宣言する必要があります。システムは実行時にこれらのパーミッションを強制します。

### 利用可能なパーミッション

| パーミッション | リスクレベル | 説明 |
|---------------|-------------|------|
| `note:read` | 低 | ノートとその内容を読み取る |
| `note:write` | 中 | ノートの作成、更新、削除 |
| `user:read` | 低 | ユーザープロフィールと情報を読み取る |
| `user:write` | 高 | ユーザーデータと設定を変更 |
| `file:read` | 低 | アップロードされたファイルとメディアを読み取る |
| `file:write` | 中 | ファイルのアップロード、変更、削除 |
| `admin:read` | 中 | 管理設定とデータを読み取る |
| `admin:write` | 高 | 管理設定を変更 |
| `config:read` | 低 | プラグイン設定を読み取る |
| `config:write` | 低 | プラグイン設定を変更 |

### イベントに必要なパーミッション

| イベント | 必要なパーミッション |
|---------|---------------------|
| `note:beforeCreate` | `note:write` |
| `note:afterCreate` | `note:read` |
| `note:beforeDelete` | `note:write` |
| `note:afterDelete` | `note:read` |
| `user:beforeRegister` | `user:write` |
| `user:afterRegister` | `user:read` |

### セキュリティに関する注意

- マニフェストのないプラグインはデフォルトで**パーミッションなし**
- 高リスクなパーミッションの組み合わせ（例: `admin:write` + `user:write`）は警告を発生
- パーミッション違反は `PluginPermissionError` をスロー

## フロントエンドプラグイン

フロントエンドプラグインは特定のスロットにUIコンポーネントを登録できます:

```tsx
// frontend/index.tsx
import { registerPluginComponent } from "rox/frontend/plugins";

function NoteFooterExtension({ noteId, pluginId }) {
  return (
    <button onClick={() => handleClick(noteId)}>
      カスタムアクション
    </button>
  );
}

registerPluginComponent("my-plugin", "note:footer", NoteFooterExtension);
```

### 利用可能なスロット

| スロット名 | 場所 | Props |
|-----------|------|-------|
| `note:footer` | ノートカードの下部 | `noteId`, `userId` |
| `note:header` | ノートカードの上部 | `noteId`, `userId` |
| `profile:header` | ユーザープロフィールヘッダー | `userId` |
| `settings:panel` | 設定ページ | `userId` |

## ベストプラクティス

### エラーハンドリング

```typescript
events.on("note:afterCreate", async ({ note }) => {
  try {
    await processNote(note);
  } catch (error) {
    logger.error({ error, noteId: note.id }, "ノートの処理に失敗しました");
    // スローしない - afterイベントはサーバーをクラッシュさせてはいけない
  }
});
```

### リソースのクリーンアップ

```typescript
let intervalId: ReturnType<typeof setInterval>;

const myPlugin: RoxPlugin = {
  onLoad({ logger }) {
    intervalId = setInterval(() => {
      logger.info("定期タスク");
    }, 60000);
  },

  onUnload() {
    clearInterval(intervalId);
  },
};
```

### 設定のバリデーション

```typescript
async function validateConfig(config: PluginConfigStorage) {
  const keywords = await config.get<string[]>("keywords");
  if (!Array.isArray(keywords)) {
    await config.set("keywords", []);
  }
}
```

### ログのベストプラクティス

```typescript
// 良い例: コンテキスト付きの構造化ログ
logger.info({ noteId, userId, action: "filter" }, "ノートがフィルタリングされました");

// 避ける: 文字列補間
logger.info(`ノート ${noteId} がユーザー ${userId} によってフィルタリングされました`);
```

## サンプル

### コンテンツモデレーションプラグイン

```typescript
import type { RoxPlugin } from "rox/plugins";

const moderationPlugin: RoxPlugin = {
  id: "content-moderation",
  name: "Content Moderation",
  version: "1.0.0",

  async onLoad({ events, config, logger }) {
    events.onBefore("note:beforeCreate", async ({ content, userId, cw }) => {
      const blockedWords = await config.get<string[]>("blockedWords") ?? [];

      for (const word of blockedWords) {
        if (content.toLowerCase().includes(word.toLowerCase())) {
          logger.warn({ userId, word }, "ブロックされたコンテンツの投稿を試みました");
          return { cancel: true, reason: "禁止ワードが含まれています" };
        }
      }

      return {};
    });
  },
};

export default moderationPlugin;
```

### アクティビティロガープラグイン

```typescript
import type { RoxPlugin } from "rox/plugins";

const loggerPlugin: RoxPlugin = {
  id: "activity-logger",
  name: "Activity Logger",
  version: "1.0.0",

  onLoad({ events, logger }) {
    events.on("note:afterCreate", ({ note }) => {
      logger.info({
        event: "note_created",
        noteId: note.id,
        userId: note.userId,
        visibility: note.visibility,
      });
    });

    events.on("user:afterRegister", ({ userId, username }) => {
      logger.info({
        event: "user_registered",
        userId,
        username,
      });
    });
  },
};

export default loggerPlugin;
```

### 統計APIプラグイン

```typescript
import type { RoxPlugin } from "rox/plugins";

let noteCount = 0;

const statsPlugin: RoxPlugin = {
  id: "stats-api",
  name: "Statistics API",
  version: "1.0.0",

  onLoad({ events }) {
    events.on("note:afterCreate", () => {
      noteCount++;
    });
  },

  routes(app) {
    app.get("/stats", (c) => {
      return c.json({
        notesCreatedSinceStartup: noteCount,
        uptime: process.uptime(),
      });
    });
  },
};

export default statsPlugin;
```

## プラグインのテスト

プラグインのテストを作成:

```typescript
// my-plugin.test.ts
import { describe, it, expect, mock } from "bun:test";
import myPlugin from "./index";

describe("my-plugin", () => {
  it("正しいメタデータを持つこと", () => {
    expect(myPlugin.id).toBe("my-plugin");
    expect(myPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("イベントを正しく処理すること", async () => {
    const mockEvents = {
      on: mock(() => () => {}),
      onBefore: mock(() => () => {}),
    };

    const mockContext = {
      events: mockEvents,
      logger: { info: mock(), warn: mock(), error: mock() },
      config: { get: mock(), set: mock() },
      baseUrl: "https://example.com",
      roxVersion: "2025.12.0",
      registerScheduledTask: mock(),
    };

    await myPlugin.onLoad?.(mockContext as any);

    expect(mockEvents.on).toHaveBeenCalled();
  });
});
```

## トラブルシューティング

### プラグインがロードされない

1. `plugin.json` の構文が有効なJSONか確認
2. `id` がディレクトリ名と一致しているか確認
3. エントリーポイントにTypeScriptエラーがないか確認
4. サーバーログでエラーメッセージを確認

### パーミッションエラー

```
PluginPermissionError: Plugin 'my-plugin' does not have permission 'note:write'
```

必要なパーミッションを `plugin.json` に追加:

```json
{
  "permissions": ["note:write"]
}
```

### ホットリロードが動作しない

ホットリロードには開発モードが必要:

```bash
NODE_ENV=development bun run dev
```

## サポート

- [GitHub Issues](https://github.com/Love-Rox/rox/issues)
- [ドキュメント](https://github.com/Love-Rox/rox/tree/main/docs/plugins)
