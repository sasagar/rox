# Roxへのコントリビューション

Roxへの貢献に興味を持っていただきありがとうございます！このドキュメントでは、プロジェクトへのコントリビューションガイドラインを提供します。

**Languages**: [English](./CONTRIBUTING.md) | 日本語

## 行動規範

すべてのやり取りにおいて敬意を持ち、建設的であること。私たちは歓迎的で包括的なコミュニティを維持することを目指しています。

## 開発環境のセットアップ

初期セットアップの手順は [README.ja.md](./README.ja.md) を参照してください。

### 追加の開発ツール

```bash
# 型チェック
bun run typecheck

# リント
bun run lint

# フォーマット
bun run format

# すべてのチェックを実行
bun run lint && bun run typecheck && bun test
```

## ドキュメント標準

### TSDocコメント

すべてのTSDocコメント（`/** */`）は**必ず英語で記述**してください：

```typescript
/**
 * Hash a password using Argon2id
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecretPassword123');
 * ```
 *
 * @remarks
 * - Algorithm: argon2id
 * - Memory cost: 19456 KiB
 */
export async function hashPassword(password: string): Promise<string> {
  // 実装...
}
```

**必須要素：**
- モジュールレベルの説明（`@module`）
- 関数/メソッドの説明
- パラメータの説明（`@param`）
- 戻り値の説明（`@returns`）
- 例外（`@throws`）該当する場合
- 使用例（`@example`）パブリックAPIの場合
- 実装メモ（`@remarks`）役立つ場合

### インラインコメント

インラインコメント（`//` または `/* */`）は日本語または英語で記述できます：

```typescript
// ユーザーごとのディレクトリに保存
const relativePath = join(metadata.userId, filename);

// Save to user-specific directory
const relativePath = join(metadata.userId, filename);
```

### ドキュメントの確認

**VSCode/Cursor**: 関数にホバーするとTSDocツールチップが表示されます

**ドキュメント生成**:
```bash
# TypeDocをインストール
bun add -d typedoc

# ドキュメントを生成
bunx typedoc --out docs/api packages/backend/src
```

**ドキュメント不足のチェック**:
```bash
# TSDoc ESLintプラグインを使用（オプション）
bun add -d eslint-plugin-tsdoc
```

## コードスタイル

### TypeScript

- **strictモード**を使用（すでに設定済み）
- オブジェクト型には `type` より `interface` を優先
- ユニオンや交差型には `type` を使用
- パブリック関数には常に戻り値の型を明示
- 意味のある変数名を使用（ループ以外では1文字を避ける）

### フォーマット

リントとフォーマットには **oxc** を使用します：

```bash
# フォーマット問題を自動修正
bun run format

# 問題をチェック
bun run lint
```

### ファイル命名

- **PascalCase**: クラス、インターフェース、型（`UserRepository.ts`）
- **camelCase**: 関数、変数、複数のエクスポートを含むファイル（`session.ts`）
- **kebab-case**: 設定ファイル（`docker-compose.yml`）

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/)に従ってください：

```
feat: ユーザー登録エンドポイントを追加
fix: セッション有効期限のバグを修正
docs: APIドキュメントを更新
refactor: パスワードハッシュロジックを簡素化
test: 認証サービスのテストを追加
chore: 依存関係を更新
```

**形式**: `<type>(<scope>): <subject>`

**タイプ：**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみ
- `style`: コードスタイルの変更（フォーマットなど）
- `refactor`: コードのリファクタリング
- `test`: テストの追加または更新
- `chore`: メンテナンスタスク

## プルリクエストプロセス

1. **フィーチャーブランチを作成**: `git checkout -b feat/your-feature`
2. **変更を加える**: コードスタイルとドキュメント標準に従う
3. **すべてのチェックを実行**: `bun run lint && bun run typecheck && bun test`
4. **変更をコミット**: Conventional Commitメッセージを使用
5. **フォークにプッシュ**: `git push origin feat/your-feature`
6. **プルリクエストを開く**: 変更の明確な説明を提供

### PRの説明テンプレート

```markdown
## 説明
変更の簡単な説明

## 変更の種類
- [ ] バグ修正
- [ ] 新機能
- [ ] 破壊的変更
- [ ] ドキュメント更新

## テスト
- [ ] テストがローカルでパス
- [ ] 新しいテストを追加
- [ ] 手動テスト完了

## チェックリスト
- [ ] コードがプロジェクトスタイルガイドラインに従っている
- [ ] TSDocコメントが英語で記述されている
- [ ] すべての関数に適切なドキュメントがある
- [ ] TypeScriptエラーがない
- [ ] テストを追加/更新
```

## テスト

### テストの実行

```bash
# すべてのテストを実行
bun test

# 特定のテストファイルを実行
bun test src/services/AuthService.test.ts

# ウォッチモードでテストを実行
bun test --watch
```

### テストの記述

```typescript
import { describe, test, expect } from 'bun:test';

describe('AuthService', () => {
  test('パスワードを正しくハッシュ化すること', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);

    expect(hash).toStartWith('$argon2id$');
    expect(await verifyPassword(password, hash)).toBe(true);
  });
});
```

## アーキテクチャパターン

### リポジトリパターン

データベース操作はリポジトリインターフェースを経由する必要があります：

```typescript
// ✅ 良い例
const user = await userRepository.findById(userId);

// ❌ 悪い例
const user = await db.select().from(users).where(eq(users.id, userId));
```

### アダプターパターン

ストレージ操作はアダプターを使用する必要があります：

```typescript
// ✅ 良い例
const url = await storageAdapter.save(file, metadata);

// ❌ 悪い例
await fs.writeFile(path, file);
```

### 依存性注入

依存性注入にはHono Contextを使用します：

```typescript
app.post('/api/notes', requireAuth(), async (c) => {
  const noteRepository = c.get('noteRepository');
  const user = c.get('user')!;

  const note = await noteRepository.create({
    userId: user.id,
    text: body.text,
  });

  return c.json(note);
});
```

## データベースマイグレーション

### マイグレーションの作成

```bash
# 1. src/db/schema/pg.ts のスキーマを更新
# 2. マイグレーションを生成
bun run db:generate

# 3. drizzle/postgres/ に生成されたマイグレーションを確認
# 4. マイグレーションを実行
bun run db:migrate
```

### マイグレーションガイドライン

- 常に本番データのコピーでマイグレーションをテストする
- 可能な限りマイグレーションを可逆的にする
- 複雑なマイグレーションはマイグレーションファイルにドキュメント化する
- デプロイ済みの既存マイグレーションは決して変更しない

## 質問がありますか？

- 既存のissueやディスカッションを確認
- プロジェクトのディスカッションで質問
- アーキテクチャの詳細は [実装ガイド](./docs/implementation/README.md) を参照

## ライセンス

貢献することで、あなたの貢献がMITライセンスの下でライセンスされることに同意したものとみなされます。
