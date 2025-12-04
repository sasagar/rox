# Rox Technology Stack

## Runtime & Language

| Technology | Purpose |
|------------|---------|
| **Bun** | JavaScript runtime, package manager, test runner |
| **TypeScript** | Primary language with strict typing |

## Backend (packages/backend)

| Technology | Purpose |
|------------|---------|
| **Hono** | Ultra-lightweight web framework with edge compatibility |
| **Drizzle ORM** | TypeScript-first ORM with multi-DB support |
| **BullMQ** | Job queue for async ActivityPub delivery |
| **ioredis** | Redis/Dragonfly client for caching |
| **Sharp** | Image processing |
| **Zod** | Runtime schema validation |
| **Pino** | Structured logging |

### Supported Databases

All databases are fully supported with dedicated schema files:

- **PostgreSQL** (recommended for production) - `src/db/schema/pg.ts`
- **MySQL/MariaDB** - `src/db/schema/mysql.ts`
- **SQLite/Cloudflare D1** - `src/db/schema/sqlite.ts`

#### Database Configuration

```bash
# PostgreSQL
DB_TYPE=postgres DATABASE_URL=postgresql://user:pass@localhost:5432/rox

# MySQL
DB_TYPE=mysql DATABASE_URL=mysql://user:pass@localhost:3306/rox

# SQLite
DB_TYPE=sqlite DATABASE_URL=./rox.db

# Cloudflare D1 (in Workers environment)
DB_TYPE=d1
```

#### Migrations

Each database has its own migration folder:
- `drizzle/postgres/` - PostgreSQL migrations
- `drizzle/mysql/` - MySQL migrations
- `drizzle/sqlite/` - SQLite/D1 migrations

Generate migrations: `DB_TYPE=<type> bun run db:generate`
Apply migrations: `DB_TYPE=<type> bun run db:migrate`

### Supported Storage

- **Local filesystem** (development)
- **S3-compatible** (AWS S3, Cloudflare R2, MinIO)

## Frontend (packages/frontend)

| Technology | Purpose |
|------------|---------|
| **Waku** | React framework with RSC support |
| **React 19** | UI library |
| **Jotai** | Atomic state management |
| **React Aria Components** | Accessible headless UI |
| **Tailwind CSS 4** | Utility-first styling |
| **Lingui** | Internationalization (i18n) |
| **Lucide React** | Icons |
| **class-variance-authority** | Component variant styling |

## Development Tools

| Tool | Purpose |
|------|---------|
| **oxlint** | Rust-based linter (replaces ESLint) |
| **TypeScript** | Type checking |
| **Drizzle Kit** | DB migrations |
| **TypeDoc** | API documentation generation |

## Testing

- **Bun Test** - Built-in test runner
- Unit tests: `packages/backend/src/tests/unit/`
- Integration tests: `packages/backend/src/tests/integration/`
- E2E tests: `packages/backend/src/tests/e2e/`

## CI/CD

- **GitHub Actions** - CI pipeline
  - Lint & type check
  - Unit tests
  - Build verification
