# Rox Implementation Overview

**Languages**: English | [日本語](./overview.md)

## Project Overview

Rox is a lightweight and high-performance ActivityPub server & client. It provides a Misskey-compatible API, designed to enable existing Misskey users to migrate smoothly.

## Design Principles

### 1. Infrastructure Agnostic

- **Multi-Database Support**: Compatible with PostgreSQL, MySQL, SQLite/Cloudflare D1
- **Multi-Storage Support**: Compatible with local filesystem, S3-compatible storage
- **Environment Variable Driven**: Switch infrastructure via environment variables

### 2. Repository Pattern & Adapter Pattern

To separate business logic from infrastructure:

- **Repository Pattern**: Abstracts database operations
  - Interfaces: `INoteRepository`, `IUserRepository`, etc.
  - Implementations: `PostgresNoteRepository`, `MySQLNoteRepository`, `D1NoteRepository`

- **Adapter Pattern**: Abstracts storage operations
  - Interface: `IFileStorage`
  - Implementations: `LocalStorageAdapter`, `S3StorageAdapter`

### 3. Dependency Injection

Dependency injection using Hono Context:

```typescript
// Select implementation based on environment variables at startup
const noteRepository = createNoteRepository(process.env.DB_TYPE);
app.use('*', async (c, next) => {
  c.set('noteRepository', noteRepository);
  await next();
});

// Controllers depend only on abstract interfaces
app.get('/api/notes', async (c) => {
  const repo = c.get('noteRepository'); // INoteRepository
  const notes = await repo.getTimeline();
  return c.json(notes);
});
```

## Technology Stack

| Category | Technology | Selection Rationale |
|----------|------------|---------------------|
| Runtime | Bun | Fast, integrated package manager & test runner |
| Language | TypeScript | Type safety, development efficiency |
| Backend | Hono | Ultra-lightweight, web standards compliant, edge compatible |
| Frontend | Waku | Native RSC support, minimal configuration |
| State | Jotai | Atomic, minimizes re-renders |
| UI Components | React Aria Components | Accessible, headless UI, WAI-ARIA compliant |
| Icons | Lucide React | Tree-shakable, lightweight, consistent |
| Styling | Tailwind CSS v4 | Build-time optimization, OKLCH color space |
| i18n | Lingui | Readable, automated, optimized (3kb) |
| ORM | Drizzle ORM | TypeScript-first, lightweight, multi-DB |
| Queue | Dragonfly/BullMQ | Async job processing (ActivityPub delivery) |
| Lint/Format | oxc | Rust-based, fast (ESLint/Prettier replacement) |

## Implementation Phases

### Phase 0: Foundation

**Goal:** Build infrastructure abstraction layer and development environment

**Duration:** 1-2 weeks

**Deliverables:**
- Monorepo structure (backend/frontend/shared)
- Database abstraction layer (Repository Pattern)
- Storage abstraction layer (Adapter Pattern)
- Dependency Injection mechanism
- Development tool configuration (TypeScript, oxc, Docker Compose)

**Completion Criteria:**
- Switch DB/storage via environment variables
- Verified operation with PostgreSQL, Local Storage
- Test infrastructure complete

### Phase 1: Misskey-Compatible API

**Goal:** Backend API that functions completely as a local SNS

**Duration:** 3-4 weeks

**Key Features:**
- Authentication (MiAuth)
- Account management
- Note functionality (posts, timeline, reactions)
- File management (drive)

**Completion Criteria:**
- All Misskey-compatible endpoints implemented
- Verified with Postman/Thunder Client
- Test coverage 80%+

### Phase 2: Frontend ✅ Complete

**Goal:** Provide a user-friendly web client

**Duration:** 3-4 weeks (Completed: 2025-11-25)

**Key Features:**
- ✅ Authentication flow (Passkey/Password)
- ✅ Timeline display (RSC, infinite scroll)
- ✅ Post functionality (text, images, CW, visibility)
- ✅ User interactions (reactions, renote, reply, follow)
- ✅ UI components (React Aria Components, Lucide React)
- ✅ Accessibility (keyboard navigation, ARIA attributes)
- ✅ Internationalization (Lingui, Japanese/English, 127 messages)

**Completion Criteria:**
- ✅ All user flows working
- ✅ Mobile responsive support
- ✅ WCAG 2.1 Level AA compliant

### Phase 3: ActivityPub Federation

**Goal:** Interoperability with other ActivityPub servers

**Duration:** 4-5 weeks

**Key Features:**
- Actor & WebFinger
- HTTP Signatures
- Inbox/Outbox
- Delivery system (Job Queue)

**Completion Criteria:**
- Successful federation with Mastodon/Misskey
- All ActivityPub activities supported
- Delivery success rate 95%+

## Architecture Overview

### Monorepo Structure

```
rox/
├── packages/
│   ├── backend/          # Hono Rox (API server)
│   │   ├── src/
│   │   │   ├── adapters/      # Infrastructure implementations
│   │   │   ├── db/            # Database layer
│   │   │   ├── interfaces/    # Abstract definitions
│   │   │   ├── repositories/  # Repository implementations
│   │   │   ├── services/      # Business logic
│   │   │   ├── routes/        # Hono endpoints
│   │   │   └── index.ts       # Entry point
│   │   └── drizzle/           # Migrations
│   ├── frontend/         # Waku Rox (Web client)
│   │   └── src/
│   │       ├── app/           # Waku routes
│   │       ├── components/    # React components
│   │       ├── lib/           # Utilities
│   │       └── styles/        # Styles
│   └── shared/           # Common code
│       └── src/
│           ├── types/         # Type definitions
│           └── utils/         # Utilities
├── docs/                 # Documentation
├── docker/               # Docker configuration
└── scripts/              # Build & deploy scripts
```

### Data Flow

#### Request Processing Flow

```
Client Request
    ↓
Hono Middleware (DI)
    ↓
Controller (routes/)
    ↓
Service (services/) ← Business logic
    ↓
Repository (repositories/) ← Data persistence
    ↓
Database / Storage Adapter
    ↓
Infrastructure (PostgreSQL, S3, etc.)
```

#### Dependency Direction

```
routes/ → services/ → repositories/ → db/
                    ↘ adapters/ → storage/

※ All dependencies point to abstractions (interfaces)
※ Concrete implementations injected via DI container at startup
```

## Parallel Work Opportunities

### After Phase 0 Complete

- ✅ Database implementations can be added sequentially (PostgreSQL → MySQL → SQLite/D1)
- ✅ Storage adapters can be added (Local → S3)

### After Phase 1 Complete

- ✅ **Phase 2 (Frontend)** and **Phase 3 (Federation)** are independent and can run in parallel
- ⚠️ However, with limited resources, Phase 2 is recommended first (improves user experience)

## Quality Assurance

### Testing Strategy

- **Unit Tests**: All Repositories, Services, Adapters
- **Integration Tests**: API endpoints (using test DB)
- **E2E Tests**: Main user flows

### Coverage Goals

- Overall: 80%+
- Business logic (services/): 90%+

### CI/CD

- Linting & Formatting (oxc)
- Type Checking (tsc)
- Unit & Integration Tests
- Build Verification

## Deployment

### VPS Environment (Recommended)

- Using Docker Compose
- PostgreSQL + Redis + Backend + Frontend
- Nginx/Caddy reverse proxy

### Edge Environment (Cloudflare)

- Cloudflare Workers (Backend)
- Cloudflare D1 (Database)
- Cloudflare R2 (Storage)
- Cloudflare Pages (Frontend)

## Risk Management

### High Risk Items

1. **Database abstraction complexity**
   - Mitigation: Prioritize PostgreSQL, others can be deferred

2. **ActivityPub compatibility**
   - Mitigation: Early testing with real servers, reference existing implementations

3. **Scalability**
   - Mitigation: Index optimization, consider cache layer

### Medium Risk Items

1. **Waku/RSC maturity**
   - Mitigation: Reference Waku official examples, consider Next.js switch if issues arise

2. **Edge environment constraints**
   - Mitigation: Prioritize VPS version, Edge version as follow-up

## Next Steps

1. Review [Phase 0 Implementation Plan](./phase-0-foundation.md)
2. Review [Important Decisions](./decisions.md)
3. Start implementation

## References

- [Project Specification (Japanese)](../project/v1.md) | [English](../project/v1.en.md)
- [Developer Guide](../../CLAUDE.md)
- [ActivityPub Specification](https://www.w3.org/TR/activitypub/)
- [Misskey API Specification](https://misskey-hub.net/docs/api/)
