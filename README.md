<p align="center">
  <img src="docs/assets/logo.svg" alt="Rox Logo" width="120" height="120" />
</p>

<h1 align="center">Rox</h1>

<p align="center">
  <strong>A lightweight ActivityPub server & client with Misskey API compatibility</strong>
</p>

<p align="center">
  <a href="https://github.com/Love-Rox/rox/actions/workflows/ci.yml">
    <img src="https://github.com/Love-Rox/rox/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <a href="https://github.com/Love-Rox/rox/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Love-Rox/rox?color=blue" alt="License" />
  </a>
  <a href="https://github.com/Love-Rox/rox/releases">
    <img src="https://img.shields.io/github/v/release/Love-Rox/rox?include_prereleases&color=green" alt="Release" />
  </a>
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=black" alt="Bun" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tests-800%2B-brightgreen" alt="Tests" />
</p>

<p align="center">
  <a href="https://activitypub.rocks/">
    <img src="https://img.shields.io/badge/ActivityPub-Federated-purple?logo=activitypub" alt="ActivityPub" />
  </a>
  <img src="https://img.shields.io/badge/Misskey_API-Compatible-86b300?logo=misskey" alt="Misskey Compatible" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supported-336791?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Love-Rox/rox?utm_source=oss&utm_medium=github&utm_campaign=Love-Rox%2Frox&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
</p>

<p align="center">
  <b>Languages</b>: English | <a href="./README.ja.md">日本語</a>
</p>

---

## Highlights

| | | | |
|:---:|:---:|:---:|:---:|
| ⚡ | 🖥️ | 🌐 | 🔒 |
| **Lightning Fast** | **Infrastructure Agnostic** | **Fully Federated** | **Secure by Design** |
| Built with Bun runtime for maximum performance | Run on VPS, Docker, or edge environments | Connect with Mastodon, Misskey, and more | Passkey, OAuth, role-based permissions |

## Features

- **Lightweight & High Performance** - Built with Bun runtime and modern web standards
- **Infrastructure Agnostic** - Run on traditional VPS (Docker) or edge environments (Cloudflare Workers/D1)
- **Misskey API Compatible** - Seamless migration for existing Misskey users
- **Multi-Database Support** - PostgreSQL, MySQL, SQLite/D1
- **Flexible Storage** - Local filesystem or S3-compatible storage (AWS S3, Cloudflare R2, MinIO)
- **Multiple Auth Methods** - Password, Passkey (WebAuthn), and OAuth (GitHub, Google, Discord, Mastodon)
- **Full ActivityPub Support** - Federation with Mastodon, Misskey, GoToSocial, and more
- **Role-Based Permissions** - Misskey-style policy system with granular access control
- **Internationalization** - English and Japanese support out of the box

## Screenshots

<details>
<summary>Click to view screenshots</summary>

> Coming soon

</details>

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- [Docker](https://www.docker.com/) and Docker Compose (for local development)
- PostgreSQL >= 14 (or MySQL >= 8.0, or SQLite)

### Installation

```bash
# Clone the repository
git clone https://github.com/Love-Rox/rox.git
cd rox

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development services (PostgreSQL + MariaDB + Dragonfly)
docker compose -f docker/compose.dev.yml up -d

# Run database migrations
bun run db:generate
bun run db:migrate

# Start development servers
bun run dev
```

The backend API will be available at `http://localhost:3000` and the frontend at `http://localhost:3001`.

## Project Structure

```
rox/
├── packages/
│   ├── backend/   # Hono Rox (API server)
│   ├── frontend/  # Waku Rox (web client)
│   └── shared/    # Common types and utilities
├── docs/          # Documentation
├── docker/        # Docker configurations
└── scripts/       # Build and deployment scripts
```

## Technology Stack

### Backend (Hono Rox)

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | **Bun** | Fast JavaScript runtime, package manager, test runner |
| Language | **TypeScript** | Type safety and development efficiency |
| Framework | **Hono** | Ultra-lightweight web framework |
| ORM | **Drizzle ORM** | TypeScript-first ORM |
| Queue | **Dragonfly / BullMQ** | Async job processing |
| Code Quality | **oxc** | Linting and formatting |

### Frontend (Waku Rox)

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | **Waku** | React Server Components framework |
| State Management | **Jotai** | Atomic state management |
| UI Components | **React Aria** | Accessible headless UI |
| Styling | **Tailwind CSS v4** | Utility-first CSS with OKLCH color space |
| Internationalization | **Lingui** | 3kb optimized i18n |

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all development servers |
| `bun run build` | Build all packages |
| `bun run test` | Run tests |
| `bun run lint` | Lint code with oxlint |
| `bun run format` | Format code with oxlint |
| `bun run typecheck` | Type check all packages |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Drizzle Studio |

### Database Configuration

<details>
<summary><b>PostgreSQL (Default)</b></summary>

```bash
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
```
</details>

<details>
<summary><b>MySQL/MariaDB</b></summary>

```bash
# MariaDB is included in the dev compose
docker compose -f docker/compose.dev.yml up -d

DB_TYPE=mysql
DATABASE_URL=mysql://rox:rox_dev_password@localhost:3306/rox
```
</details>

<details>
<summary><b>SQLite</b></summary>

```bash
DB_TYPE=sqlite
DATABASE_URL=sqlite://./rox.db
```
</details>

### Storage Configuration

<details>
<summary><b>Local Storage (Development)</b></summary>

```bash
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
```
</details>

<details>
<summary><b>S3-Compatible Storage</b></summary>

```bash
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_BUCKET_NAME=rox-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=auto
```
</details>

### OAuth Configuration

<details>
<summary><b>GitHub, Google, Discord, Mastodon</b></summary>

#### GitHub
```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=https://your-domain.com/api/auth/oauth/github/callback
```

#### Google
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/oauth/google/callback
```

#### Discord
```bash
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/oauth/discord/callback
```

#### Mastodon
```bash
MASTODON_CLIENT_ID=your-client-id
MASTODON_CLIENT_SECRET=your-client-secret
MASTODON_INSTANCE_URL=https://mastodon.social
MASTODON_REDIRECT_URI=https://your-domain.com/api/auth/oauth/mastodon/callback
```
</details>

## Architecture

Rox uses the **Repository Pattern** and **Adapter Pattern** to decouple business logic from infrastructure concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Hono Routes                            │
├─────────────────────────────────────────────────────────────┤
│                    Business Services                         │
├─────────────────────────────────────────────────────────────┤
│          Repository Interfaces │ Adapter Interfaces          │
├────────────────────────────────┼────────────────────────────┤
│  PostgreSQL │ MySQL │ SQLite   │  Local │ S3 │ R2           │
└────────────────────────────────┴────────────────────────────┘
```

- **Repository Pattern**: Database operations are abstracted through interfaces
- **Adapter Pattern**: Storage operations use adapters for different backends
- **Dependency Injection**: Implementations are injected via Hono Context

See [Implementation Guide](./docs/implementation/README.md) for detailed architectural documentation.

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Foundation (Database, Storage, DI) |
| Phase 1 | ✅ Complete | Misskey-Compatible API |
| Phase 2 | ✅ Complete | Frontend (Waku Client) |
| Phase 3 | ✅ Complete | ActivityPub Federation |
| Phase 4 | ✅ Complete | Refactoring & Optimization |
| Phase 5 | ✅ Complete | Administration & Security |
| Phase 6 | ✅ Complete | Production Readiness |
| Phase 7 | 🚧 Planned | Plugin System |

<details>
<summary><b>View detailed implementation status</b></summary>

### Phase 2: Frontend
- ✅ Waku + Jotai setup
- ✅ Tailwind CSS v4 with OKLCH colors
- ✅ React Aria Components
- ✅ Lingui i18n (English/Japanese)
- ✅ Authentication (Passkey + Password + OAuth)
- ✅ Timeline with infinite scroll
- ✅ Note Composer (text, images, CW, visibility)
- ✅ User interactions (reply, reaction, follow)
- ✅ File uploads (drag & drop, preview)
- ✅ User profile pages
- ✅ Image modal (zoom, pan, gallery)
- ✅ Full accessibility support

### Phase 3: ActivityPub
- ✅ WebFinger (RFC 7033)
- ✅ Actor documents (Person, JSON-LD)
- ✅ HTTP Signatures (RSA-SHA256, hs2019)
- ✅ Inbox (11 activity types)
- ✅ Outbox & Collections
- ✅ Activity delivery queue
- ✅ Shared inbox support
- ✅ Federation tested with Mastodon, Misskey, GoToSocial

### Phase 5: Administration
- ✅ Role-based permission system
- ✅ User management API
- ✅ Instance block management
- ✅ Invite-only registration
- ✅ User report system
- ✅ Instance settings management

</details>

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) before submitting PRs.

**Key Points:**

- TSDoc comments must be in English
- Follow the Repository and Adapter patterns
- Run `bun run lint && bun run typecheck && bun test` before submitting
- Use conventional commit messages

## License

[MIT](./LICENSE)

## Links

| Resource | Description |
|----------|-------------|
| [Contributing Guidelines](./CONTRIBUTING.md) | How to contribute |
| [DevContainer Guide](./docs/development/devcontainer.md) | VS Code/Cursor DevContainer setup |
| [Project Specification](./docs/project/v1.md) | Original spec (Japanese) |
| [Implementation Guide](./docs/implementation/README.md) | Architecture details |
| [Testing Guide](./docs/development/testing.md) | Testing documentation |
| [Deployment Guide](./docs/deployment/README.md) | Production deployment |

---

<p align="center">
  Made with ❤️ by the Rox community
</p>
