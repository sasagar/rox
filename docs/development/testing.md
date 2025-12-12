# Testing Guide

**Languages**: English | [日本語](./testing.ja.md)

Comprehensive guide for running and writing tests for Rox.

## Overview

Rox uses [Bun's built-in test runner](https://bun.sh/docs/cli/test) for all testing. Tests are organized into three categories:

- **Unit Tests**: Test individual functions and classes in isolation
- **Integration Tests**: Test API endpoints and service interactions
- **E2E Tests**: Test full ActivityPub federation flows

## Development Environment

### Using DevContainer (Recommended)

The easiest way to run tests is within the [DevContainer](./devcontainer.md), which provides all necessary services:

1. Open project in VS Code/Cursor
2. Reopen in Container
3. Run tests with `bun test`

All database services (PostgreSQL, MariaDB, Dragonfly) are automatically available.

### Local Development

If not using DevContainer, start services manually:

```bash
# Start development services
docker compose -f docker/compose.dev.yml up -d

# Wait for services to be ready
until pg_isready -h localhost -U rox -d rox; do sleep 1; done

# Run tests
bun test
```

## Test Structure

```
packages/backend/src/tests/
├── unit/                    # Unit tests
│   ├── AuthService.test.ts
│   ├── NoteService.test.ts
│   ├── UserService.test.ts
│   ├── FollowService.test.ts
│   ├── ReactionService.test.ts
│   ├── ImageProcessor.test.ts
│   ├── InboxService.test.ts
│   ├── ActivityDeliveryQueue.test.ts
│   └── inbox-handlers/      # ActivityPub inbox handler tests
│       ├── FollowHandler.test.ts
│       ├── CreateHandler.test.ts
│       ├── LikeHandler.test.ts
│       ├── AnnounceHandler.test.ts
│       ├── DeleteHandler.test.ts
│       ├── UndoHandler.test.ts
│       └── AcceptRejectHandler.test.ts
├── integration/             # Integration tests
│   └── api-endpoints.test.ts
└── e2e/                     # End-to-end tests
    └── activitypub-federation.test.ts
```

## Running Tests

### Run All Tests

```bash
bun test
```

### Run Tests with Coverage

```bash
bun test --coverage
```

### Run Specific Test File

```bash
bun test packages/backend/src/tests/unit/NoteService.test.ts
```

### Run Tests Matching Pattern

```bash
# Run all unit tests
bun test --filter "unit"

# Run inbox handler tests
bun test --filter "inbox-handlers"

# Run specific test by name
bun test --filter "should create a note"
```

### Watch Mode

```bash
bun test --watch
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NoteService } from '../../services/NoteService';

describe('NoteService', () => {
  let noteService: NoteService;
  let mockNoteRepository: any;
  let mockUserRepository: any;

  beforeEach(() => {
    // Create mock repositories
    mockNoteRepository = {
      create: mock(() => Promise.resolve({ id: 'note-123' })),
      findById: mock(() => Promise.resolve(null)),
    };
    mockUserRepository = {
      findById: mock(() => Promise.resolve({ id: 'user-123', username: 'test' })),
    };

    noteService = new NoteService(mockNoteRepository, mockUserRepository);
  });

  describe('createNote', () => {
    it('should create a note with valid input', async () => {
      const result = await noteService.create({
        text: 'Hello, world!',
        userId: 'user-123',
        visibility: 'public',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('note-123');
      expect(mockNoteRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error for empty text', async () => {
      await expect(
        noteService.create({
          text: '',
          userId: 'user-123',
          visibility: 'public',
        })
      ).rejects.toThrow();
    });
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../../app';

describe('API Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp();
  });

  describe('GET /api/notes/local-timeline', () => {
    it('should return public notes', async () => {
      const response = await app.request('/api/notes/local-timeline', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await app.request('/api/notes/local-timeline?limit=5', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBeLessThanOrEqual(5);
    });
  });
});
```

### Mocking Best Practices

```typescript
import { mock, spyOn } from 'bun:test';

// Mock a function
const mockFn = mock(() => 'mocked value');

// Spy on an existing method
const spy = spyOn(object, 'method');

// Mock module (create mock before importing)
mock.module('../../lib/someModule', () => ({
  someFunction: mock(() => 'mocked'),
}));

// Reset mocks between tests
beforeEach(() => {
  mockFn.mockClear();
});
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual components in isolation:

| Test File | Coverage |
|-----------|----------|
| `AuthService.test.ts` | Authentication, token generation, password hashing |
| `NoteService.test.ts` | Note CRUD, visibility, mentions |
| `UserService.test.ts` | User profiles, caching, lookups |
| `FollowService.test.ts` | Follow/unfollow, follower counts |
| `ReactionService.test.ts` | Emoji reactions, counts |
| `ImageProcessor.test.ts` | Image resizing, WebP conversion |
| `InboxService.test.ts` | ActivityPub inbox processing |
| `ActivityDeliveryQueue.test.ts` | Job queue, rate limiting, metrics |

### Inbox Handler Tests

ActivityPub inbox handlers have dedicated tests:

| Handler | Activities Tested |
|---------|-------------------|
| `FollowHandler` | Follow requests |
| `CreateHandler` | Note creation from remote |
| `LikeHandler` | Like/favorite activities |
| `AnnounceHandler` | Boost/renote activities |
| `DeleteHandler` | Note and actor deletion |
| `UndoHandler` | Undo Follow, Like, Announce |
| `AcceptRejectHandler` | Follow accept/reject |

### Integration Tests

Integration tests verify API endpoints work correctly:

- Authentication endpoints (`/api/auth/*`)
- Note endpoints (`/api/notes/*`)
- User endpoints (`/api/users/*`)
- Timeline endpoints
- File upload endpoints

### E2E Tests

End-to-end tests verify federation with other ActivityPub servers:

- WebFinger resolution
- Actor fetching
- Activity delivery
- Inbox processing
- HTTP Signature verification

## Environment Setup

### Database for Tests

Tests use the same database configuration as development:

```bash
# Required environment variables
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
```

**In DevContainer**, these are pre-configured. The database host is `postgres` (not `localhost`):

```bash
DATABASE_URL=postgresql://rox:rox_dev_password@postgres:5432/rox
```

### Running with Test Database

For isolated test runs, you can use a separate database:

```bash
# Local development
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox_test bun test

# In DevContainer
DATABASE_URL=postgresql://rox:rox_dev_password@postgres:5432/rox_test bun test
```

### Testing with MariaDB

The DevContainer includes MariaDB for MySQL compatibility testing:

```bash
# Switch to MariaDB
DB_TYPE=mysql
DATABASE_URL=mysql://rox:rox_dev_password@mariadb:3306/rox bun test
```

## Continuous Integration

**Unit tests** run automatically on:

- Pull request creation/update
- Push to main branch

GitHub Actions workflow runs:
1. `lint-and-typecheck` - Lint and TypeScript checks
2. `unit-tests` - All unit tests (180+ tests)
3. `build` - Backend and frontend builds

```yaml
- name: Run unit tests
  run: bun test src/tests/unit/
  working-directory: packages/backend
```

### Integration & E2E Tests

Integration and E2E tests require a running server and are **not run in CI**.
Run them manually in development or staging:

```bash
# 1. Start the server
bun run dev

# 2. In another terminal, run integration tests
bun test src/tests/integration/

# 3. Run E2E tests
bun test src/tests/e2e/
```

## Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit Tests | 80% | ~75% |
| Integration Tests | 70% | ~65% |
| E2E Tests | 50% | ~40% |

## Debugging Tests

### Verbose Output

```bash
bun test --verbose
```

### Run Single Test

```bash
bun test --filter "exact test name"
```

### Debug with Breakpoints

```typescript
// Add debugger statement in test
it('should do something', async () => {
  debugger; // Execution will pause here
  const result = await someFunction();
  expect(result).toBeDefined();
});
```

Then run:

```bash
bun test --inspect-brk
```

## Common Issues

### Tests Timing Out

Increase timeout for slow tests:

```typescript
it('should handle slow operation', async () => {
  // Test code
}, 30000); // 30 second timeout
```

### Database State Conflicts

Use transactions for test isolation:

```typescript
beforeEach(async () => {
  await db.transaction(async (tx) => {
    // Setup test data
  });
});

afterEach(async () => {
  // Clean up test data
});
```

### Mock Not Working

Ensure mocks are created before importing the module being tested:

```typescript
// Wrong - module already imported
import { someFunction } from './module';
mock.module('./module', () => ({}));

// Correct - mock before import
mock.module('./module', () => ({}));
import { someFunction } from './module';
```

## See Also

- [DevContainer Guide](./devcontainer.md) - Development environment setup
- [CLAUDE.md](../../CLAUDE.md) - Project guidelines and commands
- [Deployment Guide](../deployment/vps-docker.md) - Production deployment
