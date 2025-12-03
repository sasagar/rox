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
- **Infrastructure agnostic** - runs on traditional VPS (Docker) or edge environments (Cloudflare Workers/D1)
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
   - Concrete implementations exist per database type in `repositories/{pg,mysql,d1}/`
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
│       │   ├── storage/
│       │   │   ├── LocalStorageAdapter.ts
│       │   │   └── S3StorageAdapter.ts
│       │   └── cache/      # Cache adapters (Dragonfly)
│       ├── db/
│       │   ├── schema/     # Drizzle schema definitions
│       │   │   └── pg.ts   # PostgreSQL
│       │   └── index.ts    # DB connection initialization
│       ├── interfaces/     # Abstract definitions (Interfaces)
│       │   ├── IFileStorage.ts
│       │   └── repositories/
│       ├── repositories/   # DB operations (Repository Pattern)
│       │   └── pg/         # PostgreSQL implementations
│       ├── services/       # Business logic
│       ├── routes/         # Hono endpoints
│       ├── lib/            # Shared utilities
│       │   ├── routeUtils.ts   # Route handler utilities
│       │   └── validation.ts   # Zod validation schemas
│       └── index.ts        # Application entry point
└── frontend/
    └── src/
        ├── components/     # React components
        ├── lib/            # Frontend utilities
        ├── pages/          # Waku pages
        └── locales/        # i18n translations (en, ja)
```

## Supported Infrastructure Configurations

### Databases (DB_TYPE)

- **PostgreSQL** (default/recommended for VPS)
- **MySQL / MariaDB**
- **SQLite / Cloudflare D1** (for edge deployment)

### Storage (STORAGE_TYPE)

- **local**: Local filesystem via `Bun.write` (development/single-server)
- **s3**: S3-compatible storage (AWS S3, Cloudflare R2, MinIO)

## Environment Configuration

Critical environment variables that control infrastructure selection:

```ini
# Database selection
DB_TYPE=postgres|mysql|sqlite|d1
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
```

## Implementation Phases

### Phase 1: Foundation

- Bun + Hono project initialization (monorepo recommended)
- Drizzle ORM setup with schemas for PostgreSQL, MySQL, SQLite
- Environment-based DB/storage switching logic
- Dependency injection mechanism (via Hono Context)

### Phase 2: Misskey-Compatible API (Local API)

- **Authentication**: MiAuth session generation and verification
- **Account Management**: User registration, profile updates (`/api/i/update`)
- **Note Features**:
  - Create posts (`/api/notes/create`): text, images, CW, visibility
  - Timeline retrieval (`/api/notes/local-timeline`): pagination support
  - Reactions (`/api/notes/reactions/create`): emoji reactions
- **File Management**: Minimal drive functionality (`/api/drive/*`)

### Phase 3: Frontend (Waku Client)

- Waku + Jotai environment setup
- UI component kit with Tailwind CSS
- MiAuth authentication flow integration
- Timeline rendering with Server Components (RSC) for fast initial load
- Client Components for dynamic post/reaction interactions

### Phase 4: ActivityPub Federation

- **Actor Implementation**: `/users/:id` returning JSON-LD (Person)
- **WebFinger**: `/.well-known/webfinger` endpoint
- **Signature Processing**: HTTP Signatures (RSA-SHA256 / Ed25519)
- **Delivery System**:
  - Inbox (`/users/:id/inbox`) for activity reception and verification
  - Job Queue (Dragonfly/BullMQ) for async outbound delivery to remote servers

## Shared Package (`packages/shared`)

The shared package contains code used by both frontend and backend to ensure consistency.

### Validation Constants (`constants/validation.ts`)

Centralized validation rules to keep frontend and backend in sync:

```typescript
import {
  USERNAME_MIN_LENGTH,      // 3
  USERNAME_MAX_LENGTH,      // 20
  USERNAME_PATTERN,         // /^[a-zA-Z0-9_]+$/
  PASSWORD_MIN_LENGTH,      // 8
  NOTE_TEXT_MAX_LENGTH,     // 3000
  NOTE_CW_MAX_LENGTH,       // 100
  NOTE_MAX_FILES,           // 4
  DISPLAY_NAME_MAX_LENGTH,  // 100
  BIO_MAX_LENGTH,           // 500
  REACTION_MAX_LENGTH,      // 50
  FILE_COMMENT_MAX_LENGTH,  // 512
  DEFAULT_PAGE_LIMIT,       // 20
  MAX_PAGE_LIMIT,           // 100
} from "shared";
```

### Shared Types

Common TypeScript types used across packages:

- `User`, `UserProfile` - User entity types
- `Note`, `NoteWithRelations` - Note entity types
- `Visibility` - Note visibility enum (`public`, `home`, `followers`, `specified`)
- `UISettings` - User UI preferences

## Backend Utilities

### Route Utilities (`lib/routeUtils.ts`)

Common utilities for Hono route handlers to reduce code duplication:

```typescript
import {
  sanitizeUser,      // Remove passwordHash/privateKey from user objects
  parsePagination,   // Parse limit/offset query params with defaults
  normalizeHostname, // Normalize hostname for instance blocking
  errorResponse,     // Standardized JSON error responses
} from "../lib/routeUtils.js";

// Usage examples:
const { limit, offset } = parsePagination(c);
return c.json(sanitizeUser(user));
return errorResponse(c, "User not found", 404);
```

### Validation Schemas (`lib/validation.ts`)

Zod schemas for API request validation, using shared constants:

```typescript
import { createNoteSchema, updateProfileSchema } from "../lib/validation.js";

// Used with @hono/zod-validator middleware
app.post("/api/notes/create", zValidator("json", createNoteSchema), async (c) => {
  const data = c.req.valid("json");
  // ...
});
```

## Key Architectural Considerations

### Dependency Injection

- Use Hono Context to provide repository implementations to controllers
- Initialize concrete repository classes at application startup based on `DB_TYPE`
- Example: `context.get('noteRepository')` returns the appropriate implementation

### Multi-Database Schema Management

- Each database type has its own schema file in `db/schema/`
- Use Drizzle's migration system per database type
- Keep schema definitions synchronized across database types
- SQL-specific optimizations should be isolated to their respective repository implementations

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
