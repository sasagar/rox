# Development Guide

This guide provides instructions for setting up the development environment, running the application, and common development workflows for the Rox project.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Common Tasks](#common-tasks)
8. [Project Structure](#project-structure)
9. [Code Quality](#code-quality)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Bun** v1.0+ - JavaScript runtime, package manager, and test runner
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **PostgreSQL** v14+ - Primary database
  ```bash
  # macOS
  brew install postgresql@14
  brew services start postgresql@14

  # Ubuntu/Debian
  sudo apt install postgresql postgresql-contrib
  sudo systemctl start postgresql
  ```

- **Git** - Version control
  ```bash
  # macOS
  brew install git

  # Ubuntu/Debian
  sudo apt install git
  ```

### Optional Software

- **Docker** - For containerized PostgreSQL or Dragonfly
  ```bash
  # macOS
  brew install --cask docker

  # Ubuntu/Debian
  curl -fsSL https://get.docker.com | sh
  ```

- **Redis/Dragonfly** - For job queue (Phase 4+)
  ```bash
  # Via Docker
  docker run -d -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
  ```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/rox.git
cd rox
```

### 2. Install Dependencies

```bash
bun install
```

This installs all dependencies for both backend and frontend packages in the monorepo.

### 3. Verify Installation

```bash
bun --version
# Should output: 1.x.x
```

---

## Environment Configuration

### Backend Environment Variables

Create `.env` file in the project root or set environment variables:

```ini
# Database Configuration
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox

# Storage Configuration
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads

# Application Configuration
PORT=3000
NODE_ENV=development
URL=http://localhost:3000

# Feature Flags
ENABLE_REGISTRATION=true

# Session Configuration
SESSION_EXPIRY_DAYS=30
```

### Database Configuration Options

#### PostgreSQL (Recommended for Development)

```ini
DB_TYPE=postgres
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

#### MySQL/MariaDB (Future)

```ini
DB_TYPE=mysql
DATABASE_URL=mysql://username:password@localhost:3306/database_name
```

#### SQLite/D1 (Future)

```ini
DB_TYPE=sqlite
DATABASE_URL=file:./dev.db
```

### Storage Configuration Options

#### Local Storage (Development)

```ini
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
```

#### S3-Compatible Storage (Production)

```ini
STORAGE_TYPE=s3
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET_NAME=rox-files
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=us-east-1
```

**Supported S3 Providers:**
- AWS S3
- Cloudflare R2
- MinIO
- DigitalOcean Spaces
- Wasabi

---

## Database Setup

### 1. Create PostgreSQL Database

#### Manual Setup

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER rox WITH PASSWORD 'rox_dev_password';
CREATE DATABASE rox OWNER rox;
GRANT ALL PRIVILEGES ON DATABASE rox TO rox;
\q
```

#### Using Docker

```bash
docker run -d \
  --name rox-postgres \
  -e POSTGRES_USER=rox \
  -e POSTGRES_PASSWORD=rox_dev_password \
  -e POSTGRES_DB=rox \
  -p 5432:5432 \
  postgres:14-alpine
```

### 2. Run Database Migrations

```bash
cd packages/backend
DB_TYPE=postgres DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" bun run db:migrate
```

This creates all necessary tables using Drizzle ORM migrations.

### 3. Verify Database Schema

```bash
# Connect to database
psql postgresql://rox:rox_dev_password@localhost:5432/rox

# List tables
\dt

# Expected tables:
# users, sessions, notes, reactions, follows, drive_files
```

---

## Running the Application

### Development Mode

#### Backend Only

```bash
cd packages/backend
DB_TYPE=postgres \
DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" \
STORAGE_TYPE=local \
LOCAL_STORAGE_PATH=./uploads \
PORT=3000 \
NODE_ENV=development \
URL=http://localhost:3000 \
ENABLE_REGISTRATION=true \
SESSION_EXPIRY_DAYS=30 \
bun run dev
```

**Output:**
```
Server is running on http://localhost:3000
```

**Available Endpoints:**
- API: `http://localhost:3000/api/*`
- WebFinger: `http://localhost:3000/.well-known/webfinger`
- ActivityPub: `http://localhost:3000/users/:username`

#### Frontend (Phase 3+)

```bash
cd packages/frontend
bun run dev
```

**Output:**
```
Waku dev server running on http://localhost:3001
```

#### Full Stack

```bash
# Terminal 1 - Backend
cd packages/backend && bun run dev

# Terminal 2 - Frontend
cd packages/frontend && bun run dev
```

### Production Mode

```bash
# Build backend
cd packages/backend
bun run build

# Start production server
NODE_ENV=production bun run start
```

---

## Testing

### Run All Tests

```bash
cd packages/backend
bun test
```

**Output:**
```
36 tests, 36 passed (100%)
```

### Run Specific Test Suite

#### Unit Tests Only

```bash
bun test src/tests/unit/
```

#### Integration Tests Only

```bash
bun test src/tests/integration/
```

#### E2E Tests Only

```bash
bun test src/tests/e2e/
```

### Run Specific Test File

```bash
bun test src/tests/unit/ReactionService.test.ts
```

### Watch Mode

```bash
bun test --watch
```

### Test Prerequisites

**For Integration & E2E Tests:**

1. PostgreSQL database running
2. Development server running on port 3000
3. Environment variables set correctly

**Quick Test Setup:**

```bash
# Terminal 1 - Start server
cd packages/backend
DB_TYPE=postgres DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" bun run dev

# Terminal 2 - Run tests
cd packages/backend
bun test
```

---

## Common Tasks

### Create Database Migration

```bash
cd packages/backend
bun run db:generate
```

This generates a new migration file in `src/db/migrations/` based on schema changes.

### Reset Database

```bash
# Drop and recreate database
psql postgres -c "DROP DATABASE IF EXISTS rox;"
psql postgres -c "CREATE DATABASE rox OWNER rox;"

# Re-run migrations
DB_TYPE=postgres DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" bun run db:migrate
```

### Clear Uploads Directory

```bash
rm -rf packages/backend/uploads/*
```

### View Database Logs

```bash
# PostgreSQL logs (macOS Homebrew)
tail -f /usr/local/var/log/postgresql@14.log

# Docker PostgreSQL logs
docker logs -f rox-postgres
```

### Check Server Status

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process on port 3000
lsof -ti :3000 | xargs kill -9
```

### API Testing with curl

#### Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123",
    "name": "Alice Smith"
  }'
```

#### Login

```bash
curl -X POST http://localhost:3000/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "password123"
  }'
```

**Save token from response:**
```bash
TOKEN="your-token-here"
```

#### Create Note

```bash
curl -X POST http://localhost:3000/api/notes/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "Hello, world!",
    "visibility": "public"
  }'
```

#### Get Local Timeline

```bash
curl http://localhost:3000/api/notes/local-timeline?limit=20
```

---

## Project Structure

```
rox/
├── packages/
│   ├── backend/              # Hono backend
│   │   ├── src/
│   │   │   ├── adapters/     # Infrastructure adapters (storage, email)
│   │   │   ├── db/           # Database schemas and migrations
│   │   │   │   ├── schema/   # Drizzle schemas (pg, mysql, sqlite)
│   │   │   │   └── migrations/
│   │   │   ├── interfaces/   # Abstract interfaces
│   │   │   ├── middleware/   # Hono middleware (auth, etc.)
│   │   │   ├── repositories/ # Data access layer
│   │   │   │   ├── pg/       # PostgreSQL implementations
│   │   │   │   ├── mysql/    # MySQL implementations (future)
│   │   │   │   └── d1/       # D1 implementations (future)
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── services/     # Business logic
│   │   │   ├── tests/        # Test suites
│   │   │   │   ├── unit/
│   │   │   │   ├── integration/
│   │   │   │   └── e2e/
│   │   │   └── utils/        # Helper functions
│   │   ├── uploads/          # Local file storage (dev)
│   │   └── package.json
│   ├── frontend/             # Waku frontend (Phase 3+)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── lib/
│   │   └── package.json
│   └── shared/               # Shared types and utilities
│       └── src/
│           └── types/
├── docs/                     # Documentation
│   ├── api/                  # API reference
│   ├── implementation/       # Phase completion reports
│   └── testing/              # Test documentation
├── .gitignore
├── bun.lockb
├── package.json
├── CLAUDE.md                 # Claude Code instructions
└── README.md
```

---

## Code Quality

### Type Checking

```bash
cd packages/backend
bunx tsc --noEmit
```

### Linting (oxc)

```bash
# Run linter
bun run lint

# Auto-fix issues
bun run lint:fix
```

### Formatting (oxc)

```bash
# Check formatting
bun run format:check

# Auto-format code
bun run format
```

### Pre-commit Checks

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
set -e

echo "Running type check..."
cd packages/backend && bunx tsc --noEmit

echo "Running tests..."
bun test

echo "All checks passed!"
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## Troubleshooting

### Database Connection Errors

**Error:** `connection refused`

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL
# macOS
brew services start postgresql@14

# Ubuntu/Debian
sudo systemctl start postgresql

# Docker
docker start rox-postgres
```

### Port Already in Use

**Error:** `address already in use`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
lsof -ti :3000 | xargs kill -9
```

### Migration Errors

**Error:** `relation "users" already exists`

**Solution:**
```bash
# Reset database
psql postgres -c "DROP DATABASE rox;"
psql postgres -c "CREATE DATABASE rox OWNER rox;"

# Re-run migrations
DB_TYPE=postgres DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" bun run db:migrate
```

### Test Failures

**Issue:** Tests fail with "session not found"

**Solution:**
1. Ensure development server is running on port 3000
2. Check database is accessible
3. Verify environment variables are set correctly

**Issue:** E2E tests fail with username constraint errors

**Solution:**
- Tests create unique users with timestamps
- Database should auto-increment user IDs
- Check if database schema is up to date

### File Upload Errors

**Error:** `ENOENT: no such file or directory`

**Solution:**
```bash
# Create uploads directory
mkdir -p packages/backend/uploads

# Set permissions
chmod 755 packages/backend/uploads
```

### Hot Reload Not Working

**Issue:** Code changes not reflected in running server

**Solution:**
```bash
# Restart development server
lsof -ti :3000 | xargs kill -9
cd packages/backend && bun run dev
```

---

## Additional Resources

### Documentation

- [API Reference](./api/README.md)
- [Test Coverage Report](./testing/coverage.md)
- [Phase 2 Completion Report](./implementation/phase-2-completion.md)
- [Project Instructions (CLAUDE.md)](../CLAUDE.md)

### External Documentation

- [Bun Documentation](https://bun.sh/docs)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [ActivityPub Specification](https://www.w3.org/TR/activitypub/)
- [WebFinger RFC 7033](https://tools.ietf.org/html/rfc7033)

### Community

- GitHub Issues: Report bugs and feature requests
- Discussions: Ask questions and share ideas

---

## Development Workflow

### Daily Development

1. **Start Development Session**
   ```bash
   # Pull latest changes
   git pull origin main

   # Install dependencies (if package.json changed)
   bun install

   # Start database (if not running)
   brew services start postgresql@14

   # Start development server
   cd packages/backend && bun run dev
   ```

2. **Make Changes**
   - Edit code in `src/`
   - Server hot-reloads automatically

3. **Test Changes**
   ```bash
   # Run affected tests
   bun test src/tests/integration/

   # Or run all tests
   bun test
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature-branch
   ```

### Adding a New Feature

1. **Plan the Feature**
   - Identify required endpoints
   - Design database schema changes
   - Plan service layer logic

2. **Implement Repository (if needed)**
   ```typescript
   // src/interfaces/repositories/IFeatureRepository.ts
   export interface IFeatureRepository {
     create(data: Feature): Promise<Feature>;
     findById(id: string): Promise<Feature | null>;
   }

   // src/repositories/pg/FeatureRepository.ts
   export class PostgresFeatureRepository implements IFeatureRepository {
     // Implementation
   }
   ```

3. **Implement Service**
   ```typescript
   // src/services/FeatureService.ts
   export class FeatureService {
     constructor(private featureRepo: IFeatureRepository) {}

     async create(input: CreateInput): Promise<Feature> {
       // Business logic
     }
   }
   ```

4. **Add Routes**
   ```typescript
   // src/routes/feature.ts
   const feature = new Hono();

   feature.post('/create', requireAuth(), async (c) => {
     // Endpoint logic
   });

   export default feature;
   ```

5. **Write Tests**
   - Unit tests for service logic
   - Integration tests for API endpoints
   - E2E tests for user flows

6. **Update Documentation**
   - Add to API reference
   - Update test coverage report

---

**Last Updated**: 2025-11-25
**Maintainer**: Development Team
**Status**: Living Document
