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
git clone https://github.com/yourusername/rox.git
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

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Bun | Fast JavaScript runtime, package manager, test runner |
| Language | TypeScript | Type safety and development efficiency |
| Backend | Hono | Ultra-lightweight web framework |
| Frontend | Waku | React Server Components framework |
| State Management | Jotai | Atomic state management |
| Styling | Tailwind CSS | Utility-first CSS |
| ORM | Drizzle ORM | TypeScript-first ORM |
| Queue | Dragonfly / BullMQ | Async job processing |
| Code Quality | oxc | Linting and formatting |

## Implementation Phases

- **Phase 0**: Foundation (Database, Storage, DI) ← *Current*
- **Phase 1**: Misskey-Compatible API
- **Phase 2**: Frontend (Waku Client)
- **Phase 3**: ActivityPub Federation

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
- [API Documentation](./docs/api/) (Coming soon)
