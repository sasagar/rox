# Phase 1: Misskey-Compatible API

**期間:** 3-4週間
**ステータス:** 🔄 進行中（30%完了）
**開始日:** 2025-11-19
**前提条件:** Phase 0完了 ✅
**次フェーズ:** Phase 2 (Frontend) / Phase 3 (Federation)

## 目的

Misskey互換のAPIエンドポイントを実装し、ローカルSNSとして完全に動作するバックエンドを構築する。

## 実装順序

Phase 1は以下の順序で実装します（依存関係に基づく）:

1. **認証システム** (Week 1) ✅ 完了 - すべての認証が必要なエンドポイントの基盤
2. **ファイル管理** (Week 2) ⏳ 未着手 - ノート投稿で画像添付に必要
3. **ノートシステム** (Week 2-3) ⏳ 未着手 - コア機能
4. **アカウント管理** (Week 1-2) ⏳ 未着手 - 一部並行可能
5. **リアクション＆メタ** (Week 3) ⏳ 未着手 - 並行可能

---

## 1. 認証システム（Week 1）✅ 完了

**優先度:** 🔴 最高（すべての認証エンドポイントをブロック）
**ステータス:** ✅ 完了（2025-11-19）

### 実装内容

#### 完了した機能

1. **パスワード管理**
   - ✅ Argon2idハッシュ化（`utils/password.ts`）
   - ✅ セキュアなパスワード検証

2. **セッション管理**
   - ✅ CSPRNGによるトークン生成（`utils/session.ts`）
   - ✅ セッション有効期限管理
   - ✅ データベースベースのセッションストレージ

3. **認証サービス**
   - ✅ ユーザー登録（`services/AuthService.ts`）
   - ✅ ログイン
   - ✅ ログアウト
   - ✅ セッション検証

4. **認証ミドルウェア**
   - ✅ Bearer トークン認証（`middleware/auth.ts`）
   - ✅ オプショナル認証（`optionalAuth`）
   - ✅ 必須認証（`requireAuth`）

5. **APIエンドポイント**
   - ✅ `POST /api/users` - ユーザー登録
   - ✅ `GET /api/users/@me` - 自分の情報取得
   - ✅ `GET /api/users/:id` - ユーザー情報取得
   - ✅ `PATCH /api/users/@me` - ユーザー情報更新
   - ✅ `POST /api/auth/session` - ログイン
   - ✅ `GET /api/auth/session` - セッション検証
   - ✅ `DELETE /api/auth/session` - ログアウト

6. **バリデーション**
   - ✅ ユーザー名: 3-20文字、英数字とアンダースコア
   - ✅ メールアドレス: 形式チェック
   - ✅ パスワード: 最低8文字
   - ✅ 重複チェック（ユーザー名・メールアドレス）

7. **テスト**
   - ✅ 全エンドポイントの動作確認完了
   - ✅ 認証フローのテスト完了

### 次のステップ

現在の実装は簡易的な認証システムです。以下のMisskey互換機能は今後必要に応じて追加します：

### 1.1 MiAuth実装

Misskeyの認証フローに準拠した実装。

**エンドポイント:**

```typescript
// セッション生成
POST /api/auth/session/generate
Request: {
  appName: string;
  callback: string;
  permission: string[];
}
Response: {
  token: string;
  url: string; // 認証ページURL
}

// セッション確認
POST /api/auth/session/userkey
Request: {
  token: string;
  appSecret: string;
}
Response: {
  accessToken: string;
  user: UserProfile;
}

// サインアップ
POST /api/signup
Request: {
  username: string;
  email: string;
  password: string;
}
Response: {
  user: UserProfile;
  token: string;
}

// サインイン
POST /api/signin
Request: {
  username: string; // or email
  password: string;
}
Response: {
  user: UserProfile;
  token: string;
}
```

### 1.2 認証ミドルウェア

```typescript
// src/middleware/auth.ts
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sessionRepo = c.get('sessionRepository');
    const session = await sessionRepo.findByToken(token);

    if (!session || session.expiresAt < new Date()) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const userRepo = c.get('userRepository');
    const user = await userRepo.findById(session.userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    c.set('currentUser', user);
    await next();
  };
}
```

### 1.3 パスワードハッシュ

```typescript
// src/utils/password.ts
import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return await verify(hash, password);
}
```

**実装ファイル:**
- `/packages/backend/src/routes/auth.ts`
- `/packages/backend/src/services/AuthService.ts`
- `/packages/backend/src/middleware/auth.ts`
- `/packages/backend/src/utils/password.ts`

**完了条件:**
- [ ] MiAuthフロー実装
- [ ] サインアップ/サインイン実装
- [ ] トークン検証ミドルウェア実装
- [ ] セッション有効期限管理
- [ ] パスワードハッシュ化（Argon2）
- [ ] テストカバレッジ80%以上

---

## 2. アカウント管理（Week 1-2）

**優先度:** 🟡 高
**前提:** 認証システム完了

### 2.1 プロフィール管理

**エンドポイント:**

```typescript
// 自分のプロフィール取得
GET /api/i
Headers: Authorization: Bearer {token}
Response: UserProfile

// プロフィール更新
POST /api/i/update
Request: {
  displayName?: string;
  bio?: string;
  avatarId?: string;
  bannerId?: string;
}
Response: UserProfile

// ノートをピン
POST /api/i/pin
Request: { noteId: string }
Response: UserProfile

// ノートのピンを外す
POST /api/i/unpin
Request: { noteId: string }
Response: UserProfile
```

### 2.2 ユーザー情報取得

```typescript
// ユーザー情報取得
GET /api/users/show
Query: { userId?: string; username?: string }
Response: UserProfile

// ユーザーのノート取得
GET /api/users/notes
Query: {
  userId: string;
  limit?: number;
  sinceId?: string;
  untilId?: string;
}
Response: Note[]
```

### 2.3 フォロー機能

```typescript
// フォロー
POST /api/following/create
Request: { userId: string }
Response: Follow

// アンフォロー
POST /api/following/delete
Request: { userId: string }
Response: { success: boolean }

// フォロワー一覧
GET /api/users/followers
Query: { userId: string; limit?: number; cursor?: string }
Response: { users: UserProfile[]; nextCursor?: string }

// フォロイング一覧
GET /api/users/following
Query: { userId: string; limit?: number; cursor?: string }
Response: { users: UserProfile[]; nextCursor?: string }
```

**実装ファイル:**
- `/packages/backend/src/routes/users.ts`
- `/packages/backend/src/routes/i.ts`
- `/packages/backend/src/routes/following.ts`
- `/packages/backend/src/services/UserService.ts`
- `/packages/backend/src/services/FollowService.ts`

**完了条件:**
- [ ] プロフィール取得・更新
- [ ] ユーザー検索
- [ ] フォロー/アンフォロー
- [ ] フォロワー/フォロイング一覧（ページネーション）
- [ ] テストカバレッジ80%以上

---

## 3. ファイル管理（Week 2）

**優先度:** 🟡 高
**前提:** 認証システム完了
**ブロック:** ノート作成（画像添付）

### 3.1 ドライブAPI

**エンドポイント:**

```typescript
// ファイルアップロード
POST /api/drive/files/create
Content-Type: multipart/form-data
Body: {
  file: File;
  isSensitive?: boolean;
  comment?: string;
}
Response: DriveFile

// ファイル一覧
GET /api/drive/files
Query: { limit?: number; sinceId?: string; untilId?: string }
Response: DriveFile[]

// ファイル情報取得
GET /api/drive/files/show
Query: { fileId: string }
Response: DriveFile

// ファイル削除
POST /api/drive/files/delete
Request: { fileId: string }
Response: { success: boolean }

// ファイルメタデータ更新
POST /api/drive/files/update
Request: {
  fileId: string;
  isSensitive?: boolean;
  comment?: string;
}
Response: DriveFile
```

### 3.2 ファイル処理

```typescript
// src/services/FileService.ts
export class FileService {
  constructor(
    private fileRepo: IDriveFileRepository,
    private storage: IFileStorage
  ) {}

  async upload(
    file: File,
    userId: string,
    options?: UploadOptions
  ): Promise<DriveFile> {
    // ファイルバリデーション
    this.validateFile(file);

    // ファイル保存
    const buffer = await file.arrayBuffer();
    const url = await this.storage.save(Buffer.from(buffer), {
      name: file.name,
      type: file.type,
      size: file.size,
      userId,
    });

    // サムネイル生成（画像の場合）
    const thumbnailUrl = await this.generateThumbnail(buffer, file.type);

    // Blurhash生成（オプション）
    const blurhash = await this.generateBlurhash(buffer, file.type);

    // DB保存
    return await this.fileRepo.create({
      id: generateId(),
      userId,
      name: file.name,
      type: file.type,
      size: file.size,
      md5: await this.calculateMD5(buffer),
      url,
      thumbnailUrl,
      blurhash,
      isSensitive: options?.isSensitive ?? false,
      comment: options?.comment ?? null,
      storageKey: url,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private validateFile(file: File): void {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
    if (file.size > maxSize) {
      throw new Error('File too large');
    }

    const allowedTypes = process.env.ALLOWED_MIME_TYPES?.split(',') || [];
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      throw new Error('File type not allowed');
    }
  }

  // サムネイル生成、Blurhash生成、MD5計算などのメソッド
}
```

**実装ファイル:**
- `/packages/backend/src/routes/drive.ts`
- `/packages/backend/src/services/FileService.ts`
- `/packages/backend/src/utils/image.ts`（サムネイル生成）
- `/packages/backend/src/utils/blurhash.ts`

**完了条件:**
- [ ] ファイルアップロード
- [ ] ファイルバリデーション
- [ ] サムネイル生成（画像）
- [ ] Blurhash生成（オプション）
- [ ] ファイル一覧・削除・更新
- [ ] ストレージアダプター統合
- [ ] テストカバレッジ80%以上

---

## 4. ノートシステム（Week 2-3）

**優先度:** 🔴 最高（コア機能）
**前提:** 認証、ファイル管理完了

### 4.1 ノート作成

**エンドポイント:**

```typescript
POST /api/notes/create
Request: {
  text?: string;
  cw?: string; // Content Warning
  visibility?: 'public' | 'home' | 'followers' | 'specified';
  visibleUserIds?: string[]; // visibility=specifiedの場合
  localOnly?: boolean;
  fileIds?: string[];
  replyId?: string;
  renoteId?: string;
}
Response: Note
```

### 4.2 タイムライン

```typescript
// ローカルタイムライン
GET /api/notes/local-timeline
Query: {
  limit?: number; // default: 20
  sinceId?: string;
  untilId?: string;
}
Response: Note[]

// ホームタイムライン（フォローしているユーザーの投稿）
GET /api/notes/timeline
Query: {
  limit?: number;
  sinceId?: string;
  untilId?: string;
}
Response: Note[]

// グローバルタイムライン（Phase 3で実装）
GET /api/notes/global-timeline
Query: {
  limit?: number;
  sinceId?: string;
  untilId?: string;
}
Response: Note[]
```

### 4.3 ノート操作

```typescript
// ノート詳細取得
GET /api/notes/show
Query: { noteId: string }
Response: Note

// ノート削除
POST /api/notes/delete
Request: { noteId: string }
Response: { success: boolean }

// Renote作成
POST /api/notes/renote
Request: { noteId: string; text?: string }
Response: Note

// Renote削除
POST /api/notes/unrenote
Request: { noteId: string }
Response: { success: boolean }

// Renote一覧
GET /api/notes/renotes
Query: { noteId: string; limit?: number }
Response: Note[]

// リプライ一覧
GET /api/notes/replies
Query: { noteId: string; limit?: number }
Response: Note[]

// 会話スレッド取得
GET /api/notes/conversation
Query: { noteId: string }
Response: Note[]
```

### 4.4 NoteService実装

```typescript
// src/services/NoteService.ts
export class NoteService {
  constructor(
    private noteRepo: INoteRepository,
    private userRepo: IUserRepository,
    private fileRepo: IDriveFileRepository,
    private followRepo: IFollowRepository
  ) {}

  async create(userId: string, data: CreateNoteData): Promise<Note> {
    // バリデーション
    this.validateNote(data);

    // ファイルの所有権確認
    if (data.fileIds) {
      await this.validateFileOwnership(userId, data.fileIds);
    }

    // メンション抽出
    const mentions = this.extractMentions(data.text);

    // ハッシュタグ抽出
    const tags = this.extractHashtags(data.text);

    // ノート作成
    const note = await this.noteRepo.create({
      id: generateId(),
      userId,
      text: data.text ?? null,
      cw: data.cw ?? null,
      visibility: data.visibility ?? 'public',
      localOnly: data.localOnly ?? false,
      replyId: data.replyId ?? null,
      renoteId: data.renoteId ?? null,
      fileIds: data.fileIds ?? [],
      mentions,
      emojis: [], // カスタム絵文字は後で実装
      tags,
      uri: null, // ローカルノートはnull
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return note;
  }

  async getLocalTimeline(options: TimelineOptions): Promise<Note[]> {
    return await this.noteRepo.getLocalTimeline(options);
  }

  async getHomeTimeline(
    userId: string,
    options: TimelineOptions
  ): Promise<Note[]> {
    // フォローしているユーザーのIDを取得
    const follows = await this.followRepo.findByFollowerId(userId);
    const followingIds = follows.map((f) => f.followeeId);

    // 自分の投稿も含める
    followingIds.push(userId);

    return await this.noteRepo.getTimeline(userId, {
      ...options,
      userIds: followingIds,
    });
  }

  private extractMentions(text?: string): string[] {
    if (!text) return [];
    const regex = /@(\w+)(?:@([\w.-]+))?/g;
    const mentions: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  private extractHashtags(text?: string): string[] {
    if (!text) return [];
    const regex = /#(\w+)/g;
    const tags: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }
}
```

**実装ファイル:**
- `/packages/backend/src/routes/notes.ts`
- `/packages/backend/src/services/NoteService.ts`
- `/packages/backend/src/utils/text.ts`（メンション/ハッシュタグ抽出）

**完了条件:**
- [ ] ノート作成（テキスト、画像、CW、公開範囲）
- [ ] タイムライン取得（ローカル、ホーム）
- [ ] ページネーション（カーソルベース）
- [ ] リプライ/Renote機能
- [ ] ノート削除
- [ ] メンション/ハッシュタグ抽出
- [ ] Visibility制御
- [ ] テストカバレッジ80%以上

---

## 5. リアクションシステム（Week 3）

**優先度:** 🟢 中
**前提:** ノートシステム完了

**エンドポイント:**

```typescript
// リアクション追加
POST /api/notes/reactions/create
Request: {
  noteId: string;
  reaction: string; // 絵文字名 or Unicode
}
Response: Reaction

// リアクション削除
POST /api/notes/reactions/delete
Request: { noteId: string }
Response: { success: boolean }

// ノートのリアクション一覧
GET /api/notes/reactions
Query: { noteId: string; limit?: number }
Response: Reaction[]
```

**実装ファイル:**
- `/packages/backend/src/routes/reactions.ts`
- `/packages/backend/src/services/ReactionService.ts`

**完了条件:**
- [ ] リアクション追加・削除
- [ ] リアクション集計（ノート取得時に含める）
- [ ] Unicode絵文字対応
- [ ] テストカバレッジ80%以上

---

## 6. メタ情報・統計（Week 3）

**優先度:** 🟢 低
**並行可能:** リアクションシステムと並行可能

**エンドポイント:**

```typescript
// インスタンス情報
GET /api/meta
Response: {
  version: string;
  name: string;
  description: string;
  maintainerName: string;
  maintainerEmail: string;
  features: {
    registration: boolean;
    federation: boolean;
  };
  // ... その他のメタ情報
}

// 統計情報
GET /api/stats
Response: {
  notesCount: number;
  usersCount: number;
  instancesCount: number; // Phase 3
}
```

**実装ファイル:**
- `/packages/backend/src/routes/meta.ts`
- `/packages/backend/src/services/MetaService.ts`

**完了条件:**
- [ ] インスタンス情報エンドポイント
- [ ] 統計情報エンドポイント
- [ ] 環境変数から設定読み込み

---

## 完了条件（Phase 1全体）

- [ ] 全Misskey互換エンドポイント実装
- [ ] 認証フロー完全動作
- [ ] ノートCRUD動作
- [ ] ファイルアップロード動作
- [ ] フォロー機能動作
- [ ] リアクション機能動作
- [ ] Postman/Thunder Clientコレクション作成
- [ ] APIドキュメント生成（OpenAPI）
- [ ] テストカバレッジ80%以上
- [ ] ローカル環境で全機能動作確認

## テスト戦略

### Unit Tests
- 各Service層のビジネスロジック
- ユーティリティ関数（パスワードハッシュ、テキスト処理など）

### Integration Tests
- 各APIエンドポイント
- 認証フロー
- CRUD操作

### E2E Tests
- サインアップ → ログイン → 投稿 → リアクション
- フォロー → タイムライン取得

## ドキュメント

- [ ] OpenAPI仕様書生成
- [ ] Postmanコレクション
- [ ] API使用例

## 次フェーズへの準備

Phase 1完了後、以下のフェーズに進めます:

- **Phase 2 (Frontend)**: APIが完成しているため、すぐに開始可能
- **Phase 3 (Federation)**: ノートシステムが完成しているため、ActivityPub層を追加可能

両フェーズは独立しているため、並行作業も可能。
