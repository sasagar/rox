# Phase 0: Foundation（基盤構築）

**期間:** 1-2週間
**ステータス:** ✅ 完了（100%）
**完了日:** 2025-11-19
**前提条件:** なし
**次フェーズ:** Phase 1 (Misskey API)

## 目的

インフラストラクチャ抽象化層と開発環境を構築し、マルチDB・マルチストレージ対応の基盤を整える。

## 成果物

### 1. プロジェクト構造 ✅ 完了

- [x] Bunワークスペース設定
- [x] モノレポ構造（backend/frontend/shared）
- [x] TypeScript strict mode設定
- [x] oxc設定（リンター・フォーマッター）
- [x] .gitignore
- [x] README.md

**関連ファイル:**
- `/package.json`
- `/tsconfig.json`
- `/oxlint.json`
- `/packages/*/package.json`
- `/packages/*/tsconfig.json`

### 2. 開発環境 ✅ 完了

- [x] Docker Compose設定
  - PostgreSQL 16
  - Dragonfly（Redis互換）
  - MySQL 8（オプション、プロファイル経由）
- [x] 環境変数テンプレート（.env.example）

**関連ファイル:**
- `/compose.yml`
- `/.env.example`

**起動コマンド:**
```bash
# PostgreSQL + Dragonfly起動
docker compose up -d

# MySQL追加の場合
docker compose --profile mysql up -d
```

### 3. 共通型定義 ✅ 完了

- [x] User型
- [x] Note型
- [x] DriveFile型
- [x] Session型
- [x] Reaction型
- [x] Follow型
- [x] ID生成ユーティリティ

**関連ファイル:**
- `/packages/shared/src/types/*.ts`
- `/packages/shared/src/utils/id.ts`

### 4. データベース層 🔄 進行中

#### 4.1 スキーマ定義 ✅ 完了

- [x] PostgreSQLスキーマ定義
- [ ] MySQLスキーマ定義（優先度: 低）
- [ ] SQLiteスキーマ定義（優先度: 低）

**テーブル構成:**
- `users` - ユーザーアカウント
- `sessions` - 認証セッション
- `notes` - 投稿
- `drive_files` - アップロードファイル
- `reactions` - リアクション
- `follows` - フォロー関係

**関連ファイル:**
- `/packages/backend/src/db/schema/pg.ts` ✅
- `/packages/backend/src/db/schema/mysql.ts` ⏳
- `/packages/backend/src/db/schema/sqlite.ts` ⏳

#### 4.2 データベース接続 ✅ 完了

- [x] 接続初期化コード
- [x] DB_TYPE環境変数による切り替え
- [x] Drizzle ORM設定

**関連ファイル:**
- `/packages/backend/src/db/index.ts`
- `/packages/backend/drizzle.config.ts`

#### 4.3 マイグレーション ⏳ 未着手

- [ ] 初期マイグレーション生成
- [ ] マイグレーション実行スクリプト

**実装タスク:**
```bash
# マイグレーション生成
bun run db:generate

# マイグレーション実行
bun run db:migrate
```

**関連ファイル:**
- `/packages/backend/src/db/migrate.ts` ← 作成予定

### 5. Repository Pattern ⏳ 進行中

#### 5.1 インターフェース定義 ⏳ 未着手

**作成予定のインターフェース:**

```typescript
// IUserRepository
interface IUserRepository {
  create(user: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

// INoteRepository
interface INoteRepository {
  create(note: NewNote): Promise<Note>;
  findById(id: string): Promise<Note | null>;
  getTimeline(userId: string, options: TimelineOptions): Promise<Note[]>;
  getLocalTimeline(options: TimelineOptions): Promise<Note[]>;
  delete(id: string): Promise<void>;
}

// IDriveFileRepository
interface IDriveFileRepository {
  create(file: NewDriveFile): Promise<DriveFile>;
  findById(id: string): Promise<DriveFile | null>;
  findByUserId(userId: string, limit?: number): Promise<DriveFile[]>;
  delete(id: string): Promise<void>;
}

// ISessionRepository
interface ISessionRepository {
  create(session: NewSession): Promise<Session>;
  findByToken(token: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

// IReactionRepository
interface IReactionRepository {
  create(reaction: NewReaction): Promise<Reaction>;
  findByNoteId(noteId: string): Promise<Reaction[]>;
  countByNoteId(noteId: string): Promise<Record<string, number>>;
  delete(userId: string, noteId: string): Promise<void>;
}

// IFollowRepository
interface IFollowRepository {
  create(follow: NewFollow): Promise<Follow>;
  findByFollowerId(followerId: string): Promise<Follow[]>;
  findByFolloweeId(followeeId: string): Promise<Follow[]>;
  exists(followerId: string, followeeId: string): Promise<boolean>;
  delete(followerId: string, followeeId: string): Promise<void>;
}
```

**関連ファイル:**
- `/packages/backend/src/interfaces/repositories/IUserRepository.ts` ← 作成予定
- `/packages/backend/src/interfaces/repositories/INoteRepository.ts` ← 作成予定
- `/packages/backend/src/interfaces/repositories/IDriveFileRepository.ts` ← 作成予定
- `/packages/backend/src/interfaces/repositories/ISessionRepository.ts` ← 作成予定
- `/packages/backend/src/interfaces/repositories/IReactionRepository.ts` ← 作成予定
- `/packages/backend/src/interfaces/repositories/IFollowRepository.ts` ← 作成予定

#### 5.2 PostgreSQL実装 ⏳ 未着手

**実装予定:**
- [ ] PostgresUserRepository
- [ ] PostgresNoteRepository
- [ ] PostgresDriveFileRepository
- [ ] PostgresSessionRepository
- [ ] PostgresReactionRepository
- [ ] PostgresFollowRepository

**関連ファイル:**
- `/packages/backend/src/repositories/pg/*.ts` ← 作成予定

**実装パターン:**
```typescript
export class PostgresUserRepository implements IUserRepository {
  constructor(private db: Database) {}

  async create(user: NewUser): Promise<User> {
    const [result] = await this.db
      .insert(users)
      .values(user)
      .returning();
    return result;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  // ... その他のメソッド
}
```

### 6. Storage Adapter Pattern ⏳ 未着手

#### 6.1 インターフェース定義 ⏳ 未着手

```typescript
interface IFileStorage {
  /**
   * ファイルを保存
   * @returns 保存されたファイルのURL
   */
  save(file: Buffer, metadata: FileMetadata): Promise<string>;

  /**
   * ファイルを削除
   */
  delete(fileId: string): Promise<void>;

  /**
   * 公開URLを取得
   */
  getUrl(fileId: string): string;
}

interface FileMetadata {
  name: string;
  type: string;
  size: number;
  userId: string;
}
```

**関連ファイル:**
- `/packages/backend/src/interfaces/IFileStorage.ts` ← 作成予定

#### 6.2 Adapter実装 ⏳ 未着手

**LocalStorageAdapter:**
```typescript
export class LocalStorageAdapter implements IFileStorage {
  constructor(private basePath: string) {}

  async save(file: Buffer, metadata: FileMetadata): Promise<string> {
    const fileId = generateId();
    const ext = path.extname(metadata.name);
    const filename = `${fileId}${ext}`;
    const filepath = path.join(this.basePath, metadata.userId, filename);

    await Bun.write(filepath, file);

    return `/files/${metadata.userId}/${filename}`;
  }

  async delete(fileId: string): Promise<void> {
    // ファイル削除ロジック
  }

  getUrl(fileId: string): string {
    return `${process.env.URL}${fileId}`;
  }
}
```

**S3StorageAdapter:**
```typescript
export class S3StorageAdapter implements IFileStorage {
  constructor(
    private s3Client: S3Client,
    private bucketName: string,
    private publicUrl: string
  ) {}

  async save(file: Buffer, metadata: FileMetadata): Promise<string> {
    const fileId = generateId();
    const ext = path.extname(metadata.name);
    const key = `${metadata.userId}/${fileId}${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: metadata.type,
      })
    );

    return `/${key}`;
  }

  async delete(fileId: string): Promise<void> {
    // S3削除ロジック
  }

  getUrl(fileId: string): string {
    return `${this.publicUrl}${fileId}`;
  }
}
```

**関連ファイル:**
- `/packages/backend/src/adapters/storage/LocalStorageAdapter.ts` ← 作成予定
- `/packages/backend/src/adapters/storage/S3StorageAdapter.ts` ← 作成予定

### 7. Dependency Injection ⏳ 未着手

#### 7.1 DIコンテナ ⏳ 未着手

**実装予定:**

```typescript
// src/di/container.ts
export interface AppContext {
  userRepository: IUserRepository;
  noteRepository: INoteRepository;
  driveFileRepository: IDriveFileRepository;
  sessionRepository: ISessionRepository;
  reactionRepository: IReactionRepository;
  followRepository: IFollowRepository;
  fileStorage: IFileStorage;
}

export function createContainer(): AppContext {
  const db = getDatabase();
  const dbType = process.env.DB_TYPE || 'postgres';
  const storageType = process.env.STORAGE_TYPE || 'local';

  // Repository選択
  const repositories = createRepositories(db, dbType);

  // Storage Adapter選択
  const fileStorage = createStorageAdapter(storageType);

  return {
    ...repositories,
    fileStorage,
  };
}

function createRepositories(db: Database, dbType: string) {
  switch (dbType) {
    case 'postgres':
      return {
        userRepository: new PostgresUserRepository(db),
        noteRepository: new PostgresNoteRepository(db),
        driveFileRepository: new PostgresDriveFileRepository(db),
        sessionRepository: new PostgresSessionRepository(db),
        reactionRepository: new PostgresReactionRepository(db),
        followRepository: new PostgresFollowRepository(db),
      };
    // 他のDBタイプも同様
    default:
      throw new Error(`Unsupported DB type: ${dbType}`);
  }
}

function createStorageAdapter(storageType: string): IFileStorage {
  switch (storageType) {
    case 'local':
      return new LocalStorageAdapter(
        process.env.LOCAL_STORAGE_PATH || './uploads'
      );
    case 's3':
      const s3Client = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
      });
      return new S3StorageAdapter(
        s3Client,
        process.env.S3_BUCKET_NAME!,
        process.env.S3_PUBLIC_URL!
      );
    default:
      throw new Error(`Unsupported storage type: ${storageType}`);
  }
}
```

**関連ファイル:**
- `/packages/backend/src/di/container.ts` ← 作成予定

#### 7.2 Honoミドルウェア ⏳ 未着手

```typescript
// src/middleware/di.ts
export function diMiddleware() {
  const container = createContainer();

  return async (c: Context, next: Next) => {
    // コンテナの内容をContextに注入
    Object.entries(container).forEach(([key, value]) => {
      c.set(key as keyof AppContext, value);
    });

    await next();
  };
}
```

**関連ファイル:**
- `/packages/backend/src/middleware/di.ts` ← 作成予定

#### 7.3 エントリーポイント ⏳ 未着手

```typescript
// src/index.ts
import { Hono } from 'hono';
import { diMiddleware } from './middleware/di.js';

const app = new Hono();

// DI Middleware
app.use('*', diMiddleware());

// Routes
// app.route('/api', apiRoutes);

export default app;
```

**関連ファイル:**
- `/packages/backend/src/index.ts` ← 作成予定

### 8. テストインフラ ⏳ 未着手

- [ ] Bunテストランナー設定
- [ ] モックRepository実装
- [ ] テストデータベース設定
- [ ] テストユーティリティ

**関連ファイル:**
- `/packages/backend/src/test/` ← 作成予定

## 完了条件

- [x] モノレポ構造が動作
- [x] Docker Composeでデータベース起動
- [x] 型定義が共有パッケージに存在
- [x] PostgreSQLスキーマ定義完了
- [ ] マイグレーションが実行可能
- [ ] Repositoryインターフェース定義完了
- [ ] PostgreSQL Repositoryが全て実装
- [ ] Storage Adapterが両方実装
- [ ] DIコンテナが動作
- [ ] 環境変数でDB/Storageを切り替え可能
- [ ] 基本的なテストが実行可能

## 次のタスク

1. **Repository Interface定義** (優先度: 高)
   - 全6つのインターフェースを作成
   - TypeDocコメント追加

2. **PostgreSQL Repository実装** (優先度: 高)
   - UserRepository
   - NoteRepository
   - DriveFileRepository
   - SessionRepository
   - ReactionRepository
   - FollowRepository

3. **Storage Adapter実装** (優先度: 高)
   - LocalStorageAdapter
   - S3StorageAdapter

4. **DI Container実装** (優先度: 高)
   - コンテナ作成
   - Honoミドルウェア
   - エントリーポイント

5. **マイグレーション** (優先度: 中)
   - migrate.ts作成
   - 初期マイグレーション実行

6. **テストインフラ** (優先度: 中)
   - テストユーティリティ作成
   - モック実装

## ブロッカー

現在ブロッカーはありません。

## 備考

- MySQL/SQLiteスキーマは Phase 0 完了後に段階的に追加可能
- Phase 1（API実装）開始にはPostgreSQL Repositoryのみで十分
- テストインフラは並行して構築可能
