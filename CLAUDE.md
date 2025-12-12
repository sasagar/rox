# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Policy

### Code Documentation Standards

- **TSDoc Comments**: All TSDoc comments (/** */) MUST be written in English
  - Module-level documentation
  - Function/method documentation
  - Class/interface documentation
  - Parameter descriptions (@param)
  - Return value descriptions (@returns)
  - Example code (@example)

- **Inline Comments**: Inline comments (`//` or `/* */`) MAY be in Japanese or English
  - Implementation notes
  - TODO comments
  - Code explanations

### User-Facing Documentation

- **Primary Language**: English (for global accessibility)
- **Japanese Support**: Parallel Japanese documentation provided
  - README.ja.md (Japanese version of README.md)
  - docs/project/v1.md (Japanese specification)

### Rationale

While this project originates from a Japanese community, we maintain English-first documentation for:

- International collaboration
- Global developer accessibility
- Better IDE/tooling support (most tools expect English)
- Industry standard compliance

Japanese documentation is provided in parallel to support the local community.

## Project Overview

**Rox** is a lightweight ActivityPub server & client designed to be:

- **Lighter and faster** than existing Misskey instances
- **Infrastructure agnostic** - runs on traditional VPS (Docker) or edge environments
- **Misskey API compatible** for seamless migration of existing users

**Component Names:**

- Backend: **Hono Rox**
- Frontend: **Waku Rox**

## Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Bun | Fast JavaScript runtime, package manager, and test runner |
| Language | TypeScript | Type safety and development efficiency |
| Backend Framework | Hono | Ultra-lightweight, web standards-compliant framework with edge compatibility |
| Frontend Framework | Waku | React Server Components (RSC) native support with minimal configuration |
| State Management | Jotai | Atomic state management with minimal re-renders |
| UI Components | React Aria Components | Accessible, headless UI components with WAI-ARIA compliance |
| Styling | Tailwind CSS | Utility-first CSS with build-time optimization |
| Internationalization | Lingui | Readable, automated, and optimized (3kb) i18n for JavaScript |
| ORM | Drizzle ORM | TypeScript-first, lightweight, SQL-like operations with multi-DB support |
| Queue | Dragonfly / BullMQ | Async job processing for ActivityPub delivery (VPS environments) |
| Code Quality | oxc | Rust-based toolchain for linting and formatting (replaces ESLint/Prettier) |

## Development Commands

### Running the Application

```bash
# Development (both backend and frontend)
bun run dev

# Development (backend only)
bun run dev:backend

# Development (frontend only)
bun run dev:frontend

# Production build
bun run build

# Start production server
bun run start
```

### Testing

```bash
# Run all tests
bun test

# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# Backend tests
bun run test:backend
```

### Database

```bash
# Generate migrations
bun run db:generate

# Run migrations
bun run db:migrate

# Open Drizzle Studio
bun run db:studio

# Backup database
bun run db:backup

# Restore database
bun run db:restore
```

### Code Quality

```bash
# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format

# Check formatting
bun run format:check
```

### Internationalization

```bash
# Extract translation strings
bun run lingui:extract

# Compile translations
bun run lingui:compile
```

## DevContainer Development

This project includes a fully configured DevContainer for VS Code and Cursor, providing a consistent development environment with all necessary services.

### Quick Start with DevContainer

1. Open the project in VS Code or Cursor
2. Click "Reopen in Container" when prompted (or use Command Palette: "Dev Containers: Reopen in Container")
3. Wait for the container to build and post-create script to complete
4. Run `bun run dev` to start development servers

### What's Included

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database |
| MariaDB | 3306 | MySQL compatibility testing |
| Dragonfly | 6379 | Redis-compatible cache/queue |
| Nginx | 443, 80 | HTTPS reverse proxy with mkcert |

### Pre-installed Tools

- **Bun** - JavaScript runtime and package manager
- **Node.js 20** - For npm packages requiring Node
- **Claude Code CLI** - AI-powered coding assistant
- **mkcert** - Local HTTPS certificate generation

### VS Code Extensions (Auto-installed)

- oxc (formatter/linter)
- Tailwind CSS IntelliSense
- Docker
- GitHub Copilot
- GitLens
- Error Lens
- Path Intellisense
- Auto Rename Tag
- Code Spell Checker

### Claude Code in DevContainer

Claude Code is automatically installed in the DevContainer. Configuration and history are persisted in the project's `.claude/` directory (gitignored).

**First-time setup:**
```bash
# Authenticate with Anthropic
claude login

# Or set API key in .devcontainer/.env (gitignored)
echo "ANTHROPIC_API_KEY=your-key" >> .devcontainer/.env
```

**History persistence:**
- Claude Code settings stored in `/.claude/` (project root)
- This directory is mounted to both `/home/vscode/.claude` and `/root/.claude`
- History persists across container rebuilds
- Each project maintains separate Claude Code history

### HTTPS Development

The DevContainer includes Nginx with HTTPS support via mkcert:

- Access at `https://localhost` after starting dev server
- Certificates auto-generated on first container creation
- Stored in `docker/certs/` (gitignored)

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker/compose.yml` | Production deployment |
| `docker/compose.dev.yml` | Local development (without DevContainer) |
| `.devcontainer/compose.yml` | DevContainer services |

## Development Tools & MCP Servers

This project leverages **Model Context Protocol (MCP)** servers for enhanced development capabilities:

### context7

- **Purpose**: Fetch up-to-date documentation and code examples for any library
- **Usage**: Use when implementing features with external libraries (Hono, Waku, Drizzle, Jotai, etc.)
- **Example**: Getting the latest Hono middleware patterns or Drizzle ORM query syntax

### deepwiki

- **Purpose**: Access GitHub repository documentation and answer questions about codebases
- **Usage**: Research ActivityPub implementations, reference Misskey source code, explore related projects
- **Example**: Understanding how Misskey handles federation or researching HTTP Signatures implementations

### serena

- **Purpose**: Semantic code navigation and intelligent refactoring for this codebase
- **Usage**: Navigate symbols, find references, perform safe refactorings across the Repository/Adapter patterns
- **Example**: Renaming repository interfaces, finding all implementations of `INoteRepository`, tracking dependencies

**Integration Guidelines:**

- Use **context7** when you need library-specific documentation or examples
- Use **deepwiki** for researching external projects and specifications (ActivityPub, Misskey)
- Use **serena** for all codebase navigation, refactoring, and architectural analysis within this project

## Core Architecture Principles

### Infrastructure Abstraction via Patterns

The project uses **Repository Pattern** and **Adapter Pattern** to decouple business logic from infrastructure concerns. This enables switching databases and storage backends via environment variables without code changes.

**Key Design Decisions:**

1. **Database Abstraction Layer**
   - Controllers (Hono routes) depend only on repository interfaces (e.g., `INoteRepository`, `IUserRepository`)
   - Concrete implementations exist per database type in `repositories/pg/`
   - Selection via `DB_TYPE` environment variable at application startup
   - Dependency injection happens during DI container construction

2. **Storage Abstraction Layer**
   - All media operations go through `IFileStorage` interface
   - Implementations: `LocalStorageAdapter` (development/single-server) and `S3StorageAdapter` (S3/R2/MinIO)
   - Selection via `STORAGE_TYPE` environment variable

### Directory Structure

```text
packages/
├── shared/             # Shared code between frontend and backend
│   └── src/
│       ├── types/      # Shared TypeScript types
│       ├── utils/      # Shared utility functions
│       └── constants/  # Shared validation constants
├── backend/
│   └── src/
│       ├── adapters/       # Infrastructure implementations (Adapter Pattern)
│       │   ├── storage/    # LocalStorageAdapter, S3StorageAdapter
│       │   └── cache/      # Cache adapters (Dragonfly)
│       ├── db/
│       │   ├── schema/     # Drizzle schema definitions (pg.ts)
│       │   └── index.ts    # DB connection initialization
│       ├── di/             # Dependency injection container
│       ├── interfaces/     # Abstract definitions (Interfaces)
│       │   ├── IFileStorage.ts
│       │   └── repositories/
│       ├── middleware/     # Hono middleware (auth, rate limiting, etc.)
│       ├── repositories/   # DB operations (Repository Pattern)
│       │   └── pg/         # PostgreSQL implementations
│       ├── routes/         # Hono endpoints
│       │   └── ap/         # ActivityPub routes
│       ├── services/       # Business logic
│       │   └── ap/         # ActivityPub services
│       ├── lib/            # Shared utilities
│       ├── tests/          # Test files
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       └── index.ts        # Application entry point
└── frontend/
    └── src/
        ├── components/     # React components
        │   ├── ui/         # Reusable UI components
        │   ├── note/       # Note-related components
        │   ├── user/       # User-related components
        │   └── admin/      # Admin components
        ├── hooks/          # Custom React hooks
        ├── lib/            # Frontend utilities
        │   ├── api/        # API client
        │   ├── atoms/      # Jotai atoms
        │   └── auth/       # Authentication
        ├── pages/          # Waku pages
        └── locales/        # i18n translations (en, ja)
```

## Supported Infrastructure Configurations

### Databases (DB_TYPE)

- **PostgreSQL** (default/recommended for production)
- **MySQL / MariaDB** (planned)
- **SQLite** (planned)

### Storage (STORAGE_TYPE)

- **local**: Local filesystem via `Bun.write` (development/single-server)
- **s3**: S3-compatible storage (AWS S3, Cloudflare R2, MinIO)

## Environment Configuration

Critical environment variables that control infrastructure selection:

```ini
# Database selection
DB_TYPE=postgres
DATABASE_URL=<connection-string>

# Storage selection
STORAGE_TYPE=local|s3

# S3 Configuration (when STORAGE_TYPE=s3)
S3_ENDPOINT=<endpoint-url>
S3_BUCKET_NAME=<bucket>
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_REGION=<region>

# Application
PORT=3000
NODE_ENV=development|production
URL=<public-url>
ENABLE_REGISTRATION=true|false
SESSION_EXPIRY_DAYS=30
```

## Key Architectural Considerations

### Dependency Injection

- Use Hono Context to provide repository implementations to controllers
- Initialize concrete repository classes at application startup based on `DB_TYPE`
- Example: `context.get('noteRepository')` returns the appropriate implementation

### Storage Adapter Interface

The `IFileStorage` interface must support:

- `save(file: Buffer, metadata: FileMetadata): Promise<string>` - Returns file identifier/URL
- `delete(fileId: string): Promise<void>`
- `getUrl(fileId: string): string` - Returns publicly accessible URL

### ActivityPub Considerations

- HTTP Signatures must be strictly validated for incoming activities
- Use job queue for outbound delivery to handle retries and rate limiting
- Actor documents must be cacheable and follow ActivityPub spec
- WebFinger responses must include proper CORS headers

## Release Procedure

When bumping the version for a release, follow these steps:

### Version Files

Update version in **all** package.json files:

1. `/package.json` (root) - Project version using CalVer
2. `/packages/backend/package.json` - Package version using SemVer
3. `/packages/frontend/package.json` - Package version using SemVer
4. `/packages/shared/package.json` - Package version using SemVer

### Version Numbering Scheme

**Root version (CalVer)**: `YYYY.MM.patch[-stage.N]`
- Stable: `2025.12.0`, `2025.12.1`
- Prerelease: `2025.12.0-alpha.1`, `2025.12.0-beta.3`, `2025.12.0-rc.1`

**Package versions (SemVer)**: `MAJOR.MINOR.PATCH[-stage.N]`
- Stable: `1.0.0`, `1.0.1`, `1.1.0`
- Prerelease: `1.0.0-alpha.1`, `1.0.0-beta.3`, `1.0.0-rc.1`

### Version Examples

| Release Type | Root Version | Package Version |
|-------------|--------------|-----------------|
| First stable release | `2025.12.0` | `1.0.0` |
| Patch release | `2025.12.1` | `1.0.1` |
| Minor feature release | `2025.12.2` | `1.1.0` |
| Next alpha | `2026.1.0-alpha.1` | `1.2.0-alpha.1` |
| Beta after alpha | `2026.1.0-beta.1` | `1.2.0-beta.1` |
| Release candidate | `2026.1.0-rc.1` | `1.2.0-rc.1` |

### Prerelease Stages

1. **alpha**: Early development, unstable, breaking changes expected
2. **beta**: Feature complete, testing phase, may have bugs
3. **rc** (Release Candidate): Final testing, should be stable

### Git Tag

After committing version changes, create an annotated tag:

```bash
# Stable release
git tag -a v2025.12.0 -m "Release v2025.12.0"

# Prerelease
git tag -a v2025.12.0-beta.1 -m "Release v2025.12.0-beta.1"

# Push
git push origin <branch> && git push origin <tag>
```

### Release Checklist

1. Update all 4 package.json files with new version
2. Commit with message: `chore: bump version to X.X.X`
3. Create annotated git tag: `git tag -a vX.X.X -m "Release vX.X.X"`
4. Push commits and tag to remote
5. Create PR to main (if on dev branch)

**Note**: The auto-tag workflow automatically detects prerelease versions (alpha, beta, rc) and marks them accordingly on GitHub releases.

## Non-Functional Requirements

**Security:**

- Strict HTTP Signatures validation for federated requests
- ORM usage prevents SQL injection
- React/Waku default escaping prevents XSS

**Performance:**

- SSR/RSC for fast First Contentful Paint (FCP)
- Optional WebP conversion/compression for images
- Database query optimization per implementation

**Extensibility:**

- Core logic kept loosely coupled for future plugin system
- Interface-driven design enables swapping implementations

## Historical Documentation

For historical implementation plans and architecture decisions, see:

- `docs/implementation/` - Phase-by-phase implementation records
- `docs/implementation/archive/` - Completed task summaries
- `docs/project/v1.md` - Original project specification (Japanese)
- `docs/project/v1.en.md` - Original project specification (English)
