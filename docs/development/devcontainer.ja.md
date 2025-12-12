# DevContainer 開発ガイド

このガイドでは、VS CodeまたはCursorでRox開発用のDevContainerを使用する方法を説明します。

## 概要

DevContainerは以下を含む完全に設定された開発環境を提供します：

- 必要なサービス（PostgreSQL、MariaDB、Dragonfly、Nginx）
- mkcertによるHTTPSサポート
- プリインストールされたツール（Bun、Node.js、Claude Code）
- 推奨VS Code拡張機能
- 永続化されたデータボリューム

## クイックスタート

### 必要条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) または Docker Engine
- [VS Code](https://code.visualstudio.com/) と [Dev Containers拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- または [Cursor](https://cursor.sh/)（DevContainerサポート内蔵）

### DevContainerで開く

1. リポジトリをクローン：
   ```bash
   git clone https://github.com/Love-Rox/rox.git
   cd rox
   ```

2. VS CodeまたはCursorで開く：
   ```bash
   code .  # または cursor .
   ```

3. プロンプトが表示されたら **「コンテナーで再度開く」** をクリック
   - またはコマンドパレット: `Dev Containers: Reopen in Container`

4. コンテナのビルドを待つ（初回は2-5分）

5. post-createスクリプトが自動的に以下を実行：
   - SSL証明書の生成
   - Claude Code CLIのインストール
   - 依存関係のインストール（`bun install`）
   - 翻訳のコンパイル
   - データベースマイグレーションの実行
   - 必要なディレクトリの作成

6. 開発を開始：
   ```bash
   bun run dev
   ```

## サービス

| サービス | コンテナ名 | ポート | 説明 |
|---------|-----------|--------|------|
| PostgreSQL | rox-postgres | 5432 | メインデータベース |
| MariaDB | rox-mariadb | 3306 | MySQL互換性テスト用 |
| Dragonfly | rox-dragonfly | 6379 | Redis互換キャッシュ/キュー |
| Nginx | rox-nginx | 443, 80 | HTTPSリバースプロキシ |

### データベース接続

```bash
# PostgreSQL（デフォルト）
DATABASE_URL=postgresql://rox:rox_dev_password@postgres:5432/rox

# MariaDB（テスト用）
MARIADB_URL=mysql://rox:rox_dev_password@mariadb:3306/rox
```

### サービスへのアクセス

- **アプリケーション**: https://localhost（dev server起動後）
- **バックエンドAPI**: http://localhost:3000
- **フロントエンド**: http://localhost:3001
- **Drizzle Studio**: `bun run db:studio` を実行

## Claude Code連携

Claude Code CLIはDevContainerに自動的にインストールされます。

### 初回セットアップ

```bash
# オプション1: 対話式ログイン
claude login

# オプション2: 環境変数でAPIキーを設定
echo "ANTHROPIC_API_KEY=your-key-here" >> .devcontainer/.env
```

### 履歴の永続化

Claude Codeの設定と履歴はプロジェクトの `/.claude/` ディレクトリに保存されます：

- **保存場所**: プロジェクトルート `/.claude/`
- **Git追跡**: `.gitignore` で除外
- **コンテナマウント**:
  - `/.claude` → `/home/vscode/.claude`（vscodeユーザー）
  - `/.claude` → `/root/.claude`（rootユーザー）

この設定により：
- コンテナ再構築後も履歴が保持される
- 各プロジェクトで個別のClaude Code履歴を維持
- 設定が他のプロジェクトと共有されない

### Claude Codeの使用

```bash
# 対話セッションを開始
claude

# 質問する
claude "新しいAPIエンドポイントを追加するには？"

# コードレビュー
claude "src/routes/notes.ts の変更をレビューして"
```

## HTTPS開発

DevContainerにはmkcert生成証明書を使用したNginxによるHTTPSサポートが含まれています。

### 仕組み

1. コンテナ初回作成時に `post-create.sh` がmkcertをインストール
2. `localhost`、`127.0.0.1`、`::1` 用の証明書が生成される
3. Nginxがポート443でHTTPSを提供

### 証明書の場所

```
docker/certs/
├── localhost+2.pem      # 証明書
└── localhost+2-key.pem  # 秘密鍵
```

これらのファイルはgitignoreされ、自動的に生成されます。

### 証明書の手動再生成

```bash
cd docker/certs
mkcert localhost 127.0.0.1 ::1
```

## VS Code拡張機能

以下の拡張機能が自動的にインストールされます：

| 拡張機能 | 用途 |
|---------|------|
| oxc.oxc-vscode | リントとフォーマット |
| bradlc.vscode-tailwindcss | Tailwind CSS IntelliSense |
| ms-azuretools.vscode-docker | Dockerサポート |
| GitHub.copilot | AIコード補完 |
| GitHub.copilot-chat | AIチャット |
| eamodio.gitlens | Git可視化 |
| usernamehw.errorlens | インラインエラー表示 |
| christian-kohler.path-intellisense | パス自動補完 |
| formulahendry.auto-rename-tag | ペアタグ自動リネーム |
| streetsidesoftware.code-spell-checker | スペルチェック |

## エディタ設定

DevContainerは以下のVS Code設定を構成します：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit"
  }
}
```

## データの永続化

名前付きボリュームによりコンテナ再構築後もデータが保持されます：

| ボリューム | 用途 |
|-----------|------|
| rox-devcontainer-home | VS Codeユーザーホームディレクトリ |
| rox-devcontainer-postgres-data | PostgreSQLデータ |
| rox-devcontainer-mariadb-data | MariaDBデータ |
| rox-devcontainer-dragonfly-data | Dragonflyデータ |
| rox-devcontainer-uploads | アップロードファイル |

### データのリセット

```bash
# すべてのDevContainerボリュームを削除（警告: すべてのデータが削除されます）
docker volume rm rox-devcontainer-home rox-devcontainer-postgres-data rox-devcontainer-mariadb-data rox-devcontainer-dragonfly-data rox-devcontainer-uploads
```

## トラブルシューティング

### コンテナが起動しない

1. Dockerが実行中か確認
2. 再ビルドを試す: `Dev Containers: Rebuild Container`
3. Dockerログを確認: `docker logs rox-workspace`

### ポートが使用中

```bash
# ポートを使用しているプロセスを検索
lsof -i :5432  # または 3306, 6379 など

# 競合するサービスを停止するか、.devcontainer/compose.yml でポートを変更
```

### データベース接続失敗

```bash
# PostgreSQLの準備状況を確認
docker exec rox-postgres pg_isready -U rox -d rox

# ログを確認
docker logs rox-postgres
```

### SSL証明書の問題

```bash
# 証明書を再生成
cd docker/certs
rm -f *.pem
mkcert localhost 127.0.0.1 ::1

# Nginxを再起動
docker restart rox-nginx
```

### Claude Codeが動作しない

```bash
# インストールを確認
which claude
claude --version

# 再ログイン
claude login

# APIキーを確認
echo $ANTHROPIC_API_KEY
```

## 比較: DevContainer vs ローカル開発

| 観点 | DevContainer | ローカル開発 |
|------|--------------|-------------|
| セットアップ時間 | 2-5分（初回） | 10-30分 |
| 一貫性 | 全開発者で同一 | マシンにより異なる |
| サービス | 自動設定 | 手動セットアップ必要 |
| HTTPS | 組み込み | 手動mkcertセットアップ |
| 分離性 | 完全 | ホストと共有 |
| パフォーマンス | わずかなオーバーヘッド | ネイティブ速度 |

## ファイルリファレンス

| ファイル | 用途 |
|---------|------|
| `.devcontainer/devcontainer.json` | VS Code DevContainer設定 |
| `.devcontainer/compose.yml` | DevContainerサービス用Docker Compose |
| `.devcontainer/post-create.sh` | コンテナ作成後に実行されるセットアップスクリプト |
| `docker/nginx/conf.d/https.conf` | Nginx HTTPS設定 |
| `docker/certs/` | SSL証明書（gitignore） |

## 関連ドキュメント

- [テストガイド](./testing.ja.md)
- [VPS Dockerデプロイ](../deployment/vps-docker.md)
- [CLAUDE.md](../../CLAUDE.md) - Claude Code用プロジェクトガイドライン
