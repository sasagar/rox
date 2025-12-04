# Rox

A lightweight ActivityPub server & client with Misskey API compatibility.

**Languages**: English | [日本語](./README.ja.md)

## Features

- **Lightweight & High Performance**: Built with Bun runtime and modern web standards
- **Infrastructure Agnostic**: Run on traditional VPS (Docker) or edge environments (Cloudflare Workers/D1)
- **Misskey API Compatible**: Seamless migration for existing Misskey users
- **Multi-Database Support**: PostgreSQL, MySQL, SQLite/D1
- **Flexible Storage**: Local filesystem or S3-compatible storage (AWS S3, Cloudflare R2, MinIO)

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

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- [Docker](https://www.docker.com/) and Docker Compose (for local development)
- PostgreSQL >= 14 (or MySQL >= 8.0, or SQLite)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Love-rox/rox.git
cd rox
```

### 2. Install dependencies

```bash
bun install
```

### 3. Setup environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start development services

```bash
# Start PostgreSQL and Dragonfly
docker compose up -d

# Wait for services to be healthy
docker compose ps
```

### 5. Run database migrations

```bash
bun run db:generate
bun run db:migrate
```

### 6. Start development servers

```bash
# Start both backend and frontend
bun run dev

# Or start individually
bun run backend:dev
bun run frontend:dev
```

The backend API will be available at `http://localhost:3000` and the frontend at `http://localhost:3001`.

## Development

### Available Scripts

- `bun run dev` - Start all development servers
- `bun run build` - Build all packages
- `bun run test` - Run tests
- `bun run lint` - Lint code with oxlint
- `bun run format` - Format code with oxlint
- `bun run typecheck` - Type check all packages
- `bun run db:generate` - Generate database migrations
- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio
- `bun run db:backup` - Backup database (PostgreSQL native format)
- `bun run db:restore` - Restore database from backup
- `bun run db:export` - Export database to JSON (cross-database migration)
- `bun run db:import` - Import database from JSON

### Database Management

#### PostgreSQL (Default)

```bash
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
```

#### MySQL

```bash
# Start MySQL service
docker compose --profile mysql up -d

DB_TYPE=mysql
DATABASE_URL=mysql://rox:rox_dev_password@localhost:3306/rox
```

#### SQLite (Local Development)

```bash
DB_TYPE=sqlite
DATABASE_URL=sqlite://./rox.db
```

### Storage Configuration

#### Local Storage (Development)

```bash
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
```

#### S3-Compatible Storage

```bash
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_BUCKET_NAME=rox-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=auto
```

## Architecture

Rox uses the **Repository Pattern** and **Adapter Pattern** to decouple business logic from infrastructure concerns:

- **Repository Pattern**: Database operations are abstracted through interfaces (`INoteRepository`, `IUserRepository`, etc.)
- **Adapter Pattern**: Storage operations use adapters (`LocalStorageAdapter`, `S3StorageAdapter`)
- **Dependency Injection**: Implementations are injected via Hono Context based on environment variables

See [Implementation Guide](./docs/implementation/README.md) for detailed architectural documentation.

## Technology Stack

### Backend

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Bun | 1.1.45+ | Fast JavaScript runtime, package manager, test runner |
| Language | TypeScript | 5.x | Type safety and development efficiency |
| Framework | Hono | 4.10.6 | Ultra-lightweight web framework |
| ORM | Drizzle ORM | 0.36.4 | TypeScript-first ORM |
| Queue | Dragonfly / BullMQ | - | Async job processing |
| Code Quality | oxc | Latest | Linting and formatting |

### Frontend (✅ Implemented)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Waku | 0.27.1 | React Server Components framework |
| State Management | Jotai | 2.15.1 | Atomic state management |
| UI Components | React Aria Components | 1.6.3 | Accessible headless UI |
| Styling | Tailwind CSS v4 | 4.1.17 | Utility-first CSS with OKLCH color space |
| Internationalization | Lingui | 5.6.0 | 3kb optimized i18n (en/ja) |
| Authentication | Passkey + Password | Custom | WebAuthn + traditional auth |

## Implementation Phases

- **Phase 0**: Foundation (Database, Storage, DI) ✅ **Complete**
- **Phase 1**: Misskey-Compatible API ✅ **Complete**
- **Phase 2**: Frontend (Waku Client) ✅ **Complete**
  - ✅ Waku + Jotai setup
  - ✅ Tailwind CSS v4 with OKLCH colors
  - ✅ React Aria Components (Button, TextField, Dialog, Form, Avatar, Card)
  - ✅ Lingui i18n (English/Japanese - 87 messages)
  - ✅ Authentication (Passkey + Password)
  - ✅ Timeline (display, infinite scroll pagination)
  - ✅ Note Composer (text, images, CW, visibility, reply, renote)
  - ✅ User interactions (reply, reaction, follow/unfollow)
  - ✅ File uploads (multiple images, drag & drop, preview)
  - ✅ User profile pages (bio, stats, posts, follow button)
  - ✅ Image modal (zoom, pan, gallery navigation)
  - ✅ Accessibility (keyboard navigation, focus management, ARIA labels, screen reader support)
- **Phase 3**: ActivityPub Federation ✅ **Complete**
  - ✅ WebFinger (RFC 7033 compliant)
  - ✅ Actor documents (Person, JSON-LD)
  - ✅ HTTP Signatures (RSA-SHA256, hs2019)
  - ✅ Inbox (11 activity types: Follow, Undo Follow, Create, Like, Undo Like, Announce, Undo Announce, Delete, Accept, Update Person, Update Note)
  - ✅ Outbox & Collections (followers/following)
  - ✅ Activity delivery queue (BullMQ + Dragonfly)
  - ✅ Shared inbox support (50-90% delivery reduction)
  - ✅ Per-server rate limiting
  - ✅ Activity deduplication
  - ✅ Delivery metrics & monitoring
  - ✅ Federation tested with Mastodon, Misskey, GoToSocial
- **Phase 4**: Refactoring & Optimization ✅ **Complete**
  - ✅ Code refactoring (inbox handlers split into 11 dedicated handlers)
  - ✅ Redis caching (user profiles via CacheService)
  - ✅ Image optimization (WebP conversion via ImageProcessor)
  - ✅ Test coverage improvement (342 unit tests)
- **Phase 5**: Administration & Security ✅ **Complete**
  - ✅ Admin role and permissions (`requireAdmin` middleware)
  - ✅ Instance block management (API + federation enforcement)
  - ✅ User suspension/moderation (API + auth enforcement)
  - ✅ Rate limiting (middleware implemented)
  - ✅ Invite-only registration system (DB settings + env var fallback)
  - ✅ Invitation code management API (create, list, delete, expiry, multi-use)
  - ✅ User report system (8 report reasons)
  - ✅ Moderation tools (report management, note deletion)
  - ✅ **Role-based permission system** (Misskey-style policies)
    - Role CRUD API (`/api/admin/roles`)
    - Role assignment/unassignment
    - Permission-based middleware (`requirePermission`, `requireAdminRole`, `requireModeratorRole`)
    - Effective policy merging from multiple roles
    - Per-role invite limits and rate limit factors
  - ✅ **Instance settings management via API** (`/api/admin/settings`)
    - Registration settings (enabled, invite-only, approval required)
    - Instance metadata (name, description, maintainer email, icons, ToS, privacy policy)
- **Phase 6**: Production Readiness ✅ **Complete**
  - ✅ Input validation (Zod schemas)
  - ✅ Health checks and metrics endpoints
  - ✅ Deployment documentation (Docker & Bare Metal)
  - ✅ CI/CD workflow (GitHub Actions)
  - ✅ 342 unit tests
- **Phase 7**: Plugin System (Planned)
  - Plugin architecture design
  - Extension points
  - Plugin marketplace

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) before submitting PRs.

**Key Points:**

- TSDoc comments must be in English
- Follow the Repository and Adapter patterns
- Run `bun run lint && bun run typecheck && bun test` before submitting
- Use conventional commit messages

## License

MIT

## Links

- [Contributing Guidelines](./CONTRIBUTING.md)
- [Project Specification](./docs/project/v1.md) (Japanese)
- [Implementation Guide](./docs/implementation/README.md)
- [Testing Guide](./docs/development/testing.md)
- [Deployment Guide](./docs/deployment/README.md)
- [API Documentation](./docs/api/) (Coming soon)
