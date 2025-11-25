# Phase 3: ActivityPub Federation

**期間:** 4-5週間
**ステータス:** 🚧 実装中 (約70%完了)
**前提条件:** Phase 2 (Misskey API)完了 ✅
**最終更新:** 2025-11-25

## 目的

ActivityPub仕様に準拠した連合機能を実装し、Mastodon、Misskey等の他サーバーと相互運用可能にする。

## 重要な注意事項

⚠️ **連合機能は順序性が非常に重要** ⚠️

ActivityPubの実装は以下の順序で進める必要があります:
1. Actor & WebFinger（発見可能性）
2. HTTP Signatures（セキュリティ）
3. Inbox（受信）
4. Outbox & Delivery（送信）
5. Collections（フォロワー/フォロイング）

この順序を守らないと、他サーバーとの相互運用が困難になります。

---

## 実装順序

1. **Actor & WebFinger** (Week 1) ← 連合の基盤
2. **HTTP Signatures** (Week 1-2) ← セキュリティの要
3. **Inbox実装** (Week 2-3) ← 受信処理
4. **Outbox & 配送システム** (Week 3-4) ← 送信処理
5. **Collections & フォロー** (Week 4-5) ← フォロー管理
6. **互換性テスト** (Week 5) ← 品質保証

---

## 1. Actor & WebFinger（Week 1）

**優先度:** 🔴 最高（すべての連合機能の前提）

### 1.1 Actor Document

ActivityPub Actorドキュメントは、ユーザーのプロフィール情報と公開鍵を含むJSON-LD形式のドキュメント。

**エンドポイント:**

```typescript
GET /:username
GET /users/:id
Accept: application/activity+json, application/ld+json

Response (JSON-LD):
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://rox.example.com/users/alice",
  "type": "Person",
  "preferredUsername": "alice",
  "name": "Alice",
  "summary": "Hello, I'm Alice!",
  "inbox": "https://rox.example.com/users/alice/inbox",
  "outbox": "https://rox.example.com/users/alice/outbox",
  "followers": "https://rox.example.com/users/alice/followers",
  "following": "https://rox.example.com/users/alice/following",
  "icon": {
    "type": "Image",
    "url": "https://rox.example.com/files/avatar.jpg"
  },
  "publicKey": {
    "id": "https://rox.example.com/users/alice#main-key",
    "owner": "https://rox.example.com/users/alice",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
}
```

**実装:**

```typescript
// src/routes/ap/actor.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/:username', async (c) => {
  const { username } = c.req.param();
  const accept = c.req.header('Accept');

  // ActivityPubリクエストの判定
  if (
    !accept?.includes('application/activity+json') &&
    !accept?.includes('application/ld+json')
  ) {
    // 通常のHTMLレスポンス（フロントエンドにリダイレクト）
    return c.redirect(`/users/${username}`);
  }

  const userRepo = c.get('userRepository');
  const user = await userRepo.findByUsername(username);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  const actor = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: `${process.env.URL}/users/${user.username}`,
    type: 'Person',
    preferredUsername: user.username,
    name: user.displayName || user.username,
    summary: user.bio || '',
    inbox: `${process.env.URL}/users/${user.username}/inbox`,
    outbox: `${process.env.URL}/users/${user.username}/outbox`,
    followers: `${process.env.URL}/users/${user.username}/followers`,
    following: `${process.env.URL}/users/${user.username}/following`,
    icon: user.avatarUrl
      ? {
          type: 'Image',
          url: user.avatarUrl,
        }
      : undefined,
    publicKey: {
      id: `${process.env.URL}/users/${user.username}#main-key`,
      owner: `${process.env.URL}/users/${user.username}`,
      publicKeyPem: user.publicKey,
    },
  };

  return c.json(actor, {
    headers: {
      'Content-Type': 'application/activity+json; charset=utf-8',
    },
  });
});

export default app;
```

### 1.2 WebFinger

WebFingerは `acct:username@domain` 形式のリソースからActorのURLを発見するための仕組み。

**エンドポイント:**

```typescript
GET /.well-known/webfinger?resource=acct:alice@rox.example.com

Response (JSON):
{
  "subject": "acct:alice@rox.example.com",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://rox.example.com/users/alice"
    }
  ]
}
```

**実装:**

```typescript
// src/routes/ap/webfinger.ts
app.get('/.well-known/webfinger', async (c) => {
  const resource = c.req.query('resource');

  if (!resource?.startsWith('acct:')) {
    return c.json({ error: 'Invalid resource' }, 400);
  }

  // acct:username@domain から username を抽出
  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) {
    return c.json({ error: 'Invalid resource format' }, 400);
  }

  const [, username, domain] = match;
  const ourDomain = new URL(process.env.URL!).hostname;

  if (domain !== ourDomain) {
    return c.json({ error: 'Domain mismatch' }, 404);
  }

  const userRepo = c.get('userRepository');
  const user = await userRepo.findByUsername(username);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  return c.json(
    {
      subject: resource,
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: `${process.env.URL}/users/${username}`,
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/jrd+json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});
```

### 1.3 鍵ペア生成

```typescript
// src/utils/crypto.ts
import { generateKeyPairSync } from 'crypto';

export function generateKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}
```

**完了条件:**
- [x] Actor documentエンドポイント実装 ✅
- [x] WebFingerエンドポイント実装 ✅
- [x] 鍵ペア生成・保存 ✅
- [x] Content-Type適切に設定 ✅
- [x] CORSヘッダー設定 ✅

**実装ファイル:**
- `src/routes/ap/actor.ts` - Actor document endpoint
- `src/routes/ap/webfinger.ts` - WebFinger endpoint
- `src/utils/crypto.ts` - Key pair generation

---

## 2. HTTP Signatures（Week 1-2）

**優先度:** 🔴 最高（セキュリティの要）

### 2.1 署名生成（送信用）

```typescript
// src/utils/httpSignature.ts
import { createSign } from 'crypto';

export function signRequest(
  privateKey: string,
  keyId: string,
  method: string,
  path: string,
  body: string | null,
  headers: Record<string, string>
): string {
  const date = new Date().toUTCString();
  const digest = body
    ? `SHA-256=${crypto.createHash('sha256').update(body).digest('base64')}`
    : undefined;

  headers['Date'] = date;
  if (digest) {
    headers['Digest'] = digest;
  }

  // 署名文字列の構築
  const signatureString = [
    `(request-target): ${method.toLowerCase()} ${path}`,
    `host: ${new URL(path).host}`,
    `date: ${date}`,
    digest ? `digest: ${digest}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // RSA-SHA256で署名
  const signer = createSign('sha256');
  signer.update(signatureString);
  const signature = signer.sign(privateKey, 'base64');

  // Signatureヘッダー構築
  return [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="(request-target) host date${digest ? ' digest' : ''}"`,
    `signature="${signature}"`,
  ].join(',');
}
```

### 2.2 署名検証（受信用）

```typescript
// src/middleware/verifySignature.ts
import { createVerify } from 'crypto';

export async function verifySignature(c: Context, next: Next) {
  const signature = c.req.header('Signature');

  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  // Signatureヘッダーをパース
  const params = parseSignatureHeader(signature);
  const keyId = params.keyId;

  // リモートアクターの公開鍵を取得
  const publicKey = await fetchPublicKey(keyId);

  // 署名文字列を再構築
  const signatureString = reconstructSignatureString(c, params.headers);

  // 検証
  const verifier = createVerify('sha256');
  verifier.update(signatureString);
  const isValid = verifier.verify(publicKey, params.signature, 'base64');

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  await next();
}

async function fetchPublicKey(keyId: string): Promise<string> {
  // キャッシュチェック
  const cached = await getCachedPublicKey(keyId);
  if (cached) return cached;

  // Actorドキュメントを取得
  const response = await fetch(keyId, {
    headers: {
      Accept: 'application/activity+json',
    },
  });

  const actor = await response.json();
  const publicKey = actor.publicKey.publicKeyPem;

  // キャッシュ保存
  await cachePublicKey(keyId, publicKey, 3600); // 1時間

  return publicKey;
}
```

**完了条件:**
- [x] 署名生成実装 ✅
- [x] 署名検証実装 ✅
- [x] 公開鍵フェッチ・キャッシュ ✅
- [x] Date/Digestヘッダー検証 ✅
- [x] リプレイ攻撃対策 ✅

**実装ファイル:**
- `src/utils/crypto.ts` - Signature generation
- `src/middleware/httpSignature.ts` - Signature verification middleware
- `src/services/ap/ActivityPubActorService.ts` - Public key caching

---

## 3. Inbox実装（Week 2-3）

**優先度:** 🔴 最高

### 3.1 Inboxエンドポイント

```typescript
// src/routes/ap/inbox.ts
app.post('/users/:username/inbox', verifySignature, async (c) => {
  const activity = await c.req.json();

  // アクティビティタイプごとに処理
  switch (activity.type) {
    case 'Create':
      await handleCreate(c, activity);
      break;
    case 'Update':
      await handleUpdate(c, activity);
      break;
    case 'Delete':
      await handleDelete(c, activity);
      break;
    case 'Follow':
      await handleFollow(c, activity);
      break;
    case 'Accept':
      await handleAccept(c, activity);
      break;
    case 'Reject':
      await handleReject(c, activity);
      break;
    case 'Announce':
      await handleAnnounce(c, activity);
      break;
    case 'Like':
      await handleLike(c, activity);
      break;
    case 'Undo':
      await handleUndo(c, activity);
      break;
    default:
      console.log(`Unsupported activity type: ${activity.type}`);
  }

  return c.json({ status: 'ok' }, 202);
});
```

### 3.2 アクティビティハンドラー

```typescript
// src/services/ap/ActivityHandler.ts
export class ActivityHandler {
  async handleCreate(activity: Activity): Promise<void> {
    const object = activity.object;

    if (object.type === 'Note') {
      // リモートノートを保存
      const noteRepo = this.noteRepo;
      await noteRepo.create({
        id: generateId(),
        userId: await this.resolveRemoteUser(activity.actor),
        text: object.content,
        cw: object.summary,
        visibility: this.mapVisibility(object),
        localOnly: false,
        uri: object.id,
        // ... その他のフィールド
      });
    }
  }

  async handleFollow(activity: Activity): Promise<void> {
    const follower = await this.resolveRemoteUser(activity.actor);
    const followee = await this.resolveLocalUser(activity.object);

    // フォローリクエストを保存
    await this.followRepo.create({
      id: generateId(),
      followerId: follower,
      followeeId: followee,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Accept activityを送信
    await this.sendAccept(activity);
  }

  // ... 他のハンドラー
}
```

**完了条件:**
- [x] Inboxエンドポイント実装 ✅
- [x] Follow Activity 処理 ✅
- [x] Accept Activity 送信 ✅
- [x] リモートユーザー保存 ✅
- [ ] Create Activity 処理 (部分的実装)
- [ ] Undo Activity 処理
- [ ] Like/Announce Activity 処理
- [ ] 重複排除
- [ ] オブジェクトフェッチ

**実装ファイル:**
- `src/routes/ap/inbox.ts` - Inbox endpoint
- `src/services/ap/ActivityHandler.ts` - Activity handler logic
- `src/services/ap/ActivityPubActorService.ts` - Remote actor handling

---

## 4. Outbox & 配送システム（Week 3-4）

**優先度:** 🔴 最高

### 4.1 Outboxエンドポイント

```typescript
// src/routes/ap/outbox.ts
app.get('/users/:username/outbox', async (c) => {
  const { username } = c.req.param();
  const page = c.req.query('page');

  const userRepo = c.get('userRepository');
  const user = await userRepo.findByUsername(username);

  if (!user) return c.notFound();

  if (!page) {
    // Collection metadata
    return c.json({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${process.env.URL}/users/${username}/outbox`,
      type: 'OrderedCollection',
      totalItems: await countUserNotes(user.id),
      first: `${process.env.URL}/users/${username}/outbox?page=1`,
    });
  }

  // ページング
  const notes = await getUserNotes(user.id, parseInt(page));
  const activities = notes.map((note) => createActivity(note));

  return c.json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${process.env.URL}/users/${username}/outbox?page=${page}`,
    type: 'OrderedCollectionPage',
    orderedItems: activities,
  });
});
```

### 4.2 配送キュー（BullMQ）

```typescript
// src/services/ap/DeliveryQueue.ts
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL);

export const deliveryQueue = new Queue('ap-delivery', { connection });

// ワーカー
const worker = new Worker(
  'ap-delivery',
  async (job) => {
    const { activity, inboxUrl, actorPrivateKey, actorKeyId } = job.data;

    try {
      await deliverActivity(activity, inboxUrl, actorPrivateKey, actorKeyId);
    } catch (error) {
      console.error(`Delivery failed:`, error);
      throw error; // リトライのため再スロー
    }
  },
  {
    connection,
    limiter: {
      max: 10, // 10リクエスト/秒
      duration: 1000,
    },
  }
);

async function deliverActivity(
  activity: Activity,
  inboxUrl: string,
  privateKey: string,
  keyId: string
): Promise<void> {
  const body = JSON.stringify(activity);
  const headers: Record<string, string> = {
    'Content-Type': 'application/activity+json',
  };

  const signature = signRequest(privateKey, keyId, 'POST', inboxUrl, body, headers);
  headers['Signature'] = signature;

  const response = await fetch(inboxUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`Delivery failed: ${response.statusText}`);
  }
}
```

### 4.3 配送トリガー

```typescript
// src/services/NoteService.ts（Phase 1から拡張）
export class NoteService {
  async create(userId: string, data: CreateNoteData): Promise<Note> {
    // ノート作成（既存）
    const note = await this.noteRepo.create(/* ... */);

    // 連合配送
    if (process.env.ENABLE_FEDERATION === 'true') {
      await this.deliverNote(note);
    }

    return note;
  }

  private async deliverNote(note: Note): Promise<void> {
    const user = await this.userRepo.findById(note.userId);
    const followers = await this.followRepo.findByFolloweeId(note.userId);

    // フォロワーのInbox URLを取得
    const inboxUrls = await Promise.all(
      followers.map(async (follow) => {
        const follower = await this.userRepo.findById(follow.followerId);
        if (follower.host) {
          // リモートユーザー
          return follower.inbox; // inbox URL saved in user record
        }
        return null;
      })
    );

    const uniqueInboxes = [...new Set(inboxUrls.filter(Boolean))];

    // Create activityを生成
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      actor: `${process.env.URL}/users/${user.username}`,
      object: this.noteToActivityPubObject(note),
    };

    // 各Inboxに配送キューイング
    for (const inbox of uniqueInboxes) {
      await deliveryQueue.add('deliver', {
        activity,
        inboxUrl: inbox,
        actorPrivateKey: user.privateKey,
        actorKeyId: `${process.env.URL}/users/${user.username}#main-key`,
      });
    }
  }
}
```

**完了条件:**
- [x] Outboxエンドポイント (基本実装) ✅
- [ ] BullMQ配送キュー ⚠️ **最優先実装項目**
- [ ] 配送ワーカー ⚠️ **最優先実装項目**
- [ ] リトライロジック（1分/5分/30分）
- [ ] レート制限
- [ ] Shared Inbox対応
- [ ] Note作成時の自動配送

**実装ファイル:**
- `src/routes/ap/outbox.ts` - Outbox endpoint (implemented)
- `src/services/ap/ActivityPubDeliveryService.ts` - Delivery service (skeleton only)

**優先度:** 🔴 **最高** - このセクションの完了がPhase 3完了の鍵

---

## 5. Collections & フォロー（Week 4-5）

### 5.1 Followersコレクション

```typescript
GET /users/:username/followers
Response: OrderedCollection with paging
```

### 5.2 Followingコレクション

```typescript
GET /users/:username/following
Response: OrderedCollection with paging
```

**完了条件:**
- [x] Followersコレクション実装 ✅
- [x] Followingコレクション実装 ✅
- [x] ページネーション対応 ✅
- [ ] プライバシー制御

**実装ファイル:**
- `src/routes/ap/collections.ts` - Collections endpoints

---

## 6. 互換性テスト（Week 5）

**テスト対象:**
- [ ] Mastodon v4.x
- [ ] Misskey v13/v14
- [ ] Pleroma/Akkoma

**テスト項目:**
- [ ] フォロー/フォロワー
- [ ] ノート配送・受信
- [ ] リプライ
- [ ] Renote/Boost
- [ ] リアクション/Like
- [ ] 削除

**デバッグツール:**
- [ ] Activity Inspector UI
- [ ] 配送ログビューワー
- [ ] 署名検証ツール

---

## 完了条件（Phase 3全体）

- [x] WebFinger実装 ✅
- [x] Actor document実装 ✅
- [x] HTTP Signatures正常動作 ✅
- [x] Inbox実装（Follow対応） ✅
- [x] Outbox基本実装 ✅
- [x] Collections実装 ✅
- [ ] BullMQ配送キュー実装 ⚠️ **最優先**
- [ ] 配送ワーカー実装 ⚠️ **最優先**
- [ ] リトライ機構動作
- [ ] 配送成功率95%以上
- [ ] 全アクティビティタイプ対応
- [ ] Mastodonと連合成功
- [ ] Misskeyと連合成功
- [ ] 基本的なモデレーション機能

## Phase 3 進捗状況

**完了率:** 約70%

**完了したコンポーネント:**
- ✅ WebFinger Discovery
- ✅ Actor Document
- ✅ HTTP Signatures (generation & verification)
- ✅ Inbox (Follow activity)
- ✅ Outbox (basic endpoint)
- ✅ Collections (Followers/Following)
- ✅ Public key management
- ✅ Remote actor caching

**未完了のコンポーネント (優先度順):**
1. 🔴 **BullMQ配送キュー** - プロダクション必須
2. 🔴 **配送ワーカー** - プロダクション必須
3. 🟡 リトライロジック
4. 🟡 追加Activityタイプ (Undo, Like, Announce)
5. 🟢 実サーバー連合テスト

**テスト結果:**
- 全36テスト合格 ✅
- TypeScript型エラー 0件 ✅
- ActivityPubコア機能動作確認済み ✅

詳細は [activitypub-test-results.md](../activitypub-test-results.md) を参照。

## 参考資料

- [ActivityPub仕様](https://www.w3.org/TR/activitypub/)
- [ActivityStreams仕様](https://www.w3.org/TR/activitystreams-core/)
- [HTTP Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)
- [Mastodon実装](https://github.com/mastodon/mastodon)
- [Misskey実装](https://github.com/misskey-dev/misskey)
