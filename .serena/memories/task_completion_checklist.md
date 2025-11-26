# Task Completion Checklist

When completing any development task, follow this checklist to ensure code quality and consistency.

## Pre-Commit Checklist

### 1. Code Quality

```bash
# Run all quality checks
bun run lint && bun run typecheck && bun test
```

**Individual Checks:**

- [ ] **Linting**: `bun run lint` passes with no warnings
- [ ] **Type Checking**: `bun run typecheck` passes with 0 errors
- [ ] **Tests**: `bun test` passes all tests

### 2. Documentation

- [ ] **TSDoc Comments**: All public functions have English TSDoc comments
  - Function description
  - `@param` for all parameters
  - `@returns` for return values
  - `@example` for public APIs (when applicable)
  
- [ ] **Inline Comments**: Complex logic has explanatory comments (English or Japanese)

### 3. Code Style

- [ ] **Naming Conventions**: 
  - PascalCase for classes/interfaces/types
  - camelCase for functions/variables
  - Meaningful variable names (no single letters except loops)

- [ ] **Type Safety**:
  - Return types specified for public functions
  - No `any` types (use `unknown` if needed)
  - Proper null/undefined handling

- [ ] **Error Handling**:
  - Try-catch blocks for operations that can fail
  - Appropriate HTTP status codes in API responses
  - Error messages are clear and actionable

### 4. Architecture Compliance

- [ ] **Repository Pattern**: Database operations go through repository interfaces
- [ ] **Adapter Pattern**: Storage operations use storage adapters
- [ ] **Dependency Injection**: Dependencies injected via Hono Context
- [ ] **Service Layer**: Business logic in service layer, not in routes

### 5. Testing

- [ ] **Unit Tests**: New functionality has corresponding tests
- [ ] **Test Coverage**: Tests cover happy path and error cases
- [ ] **Manual Testing**: Feature tested locally with real data

### 6. Git Workflow

- [ ] **Branch**: Created from latest main branch
- [ ] **Commits**: Follow Conventional Commits format
  - `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- [ ] **Commit Messages**: Clear and descriptive

### 7. Pull Request (if applicable)

- [ ] **Description**: Clear explanation of changes
- [ ] **Type**: Specified (bug fix, feature, breaking change, docs)
- [ ] **Testing**: Documented how changes were tested
- [ ] **Breaking Changes**: Documented if any

## Special Considerations

### When Adding New Routes

- [ ] Route registered in appropriate route file
- [ ] Authentication middleware applied if needed (`requireAuth()`)
- [ ] Repository/service dependencies obtained from context
- [ ] Input validation implemented
- [ ] Error responses with appropriate status codes

### When Modifying Database Schema

- [ ] Schema changes in all database types (pg, mysql, sqlite)
- [ ] Migration generated: `bun run db:generate`
- [ ] Migration tested: `bun run db:migrate`
- [ ] Repository interfaces updated if needed

### When Adding Dependencies

- [ ] Dependency added with `bun add [package]`
- [ ] Lock file (`bun.lock`) updated
- [ ] Documented why dependency is needed (in PR or commit message)

### When Working with ActivityPub

- [ ] HTTP Signatures properly generated/verified
- [ ] Activity types follow ActivityPub spec
- [ ] Delivery uses queue system (BullMQ)
- [ ] Retry logic in place for failed deliveries

## TypeScript Test File Requirements

When writing test files, ensure:

- [ ] **No unused imports**: Remove any imported types/functions not used in the file
- [ ] **Proper type assertions**: Use `as { property: type }` when accessing `.json()` response properties
- [ ] **No unused variables**: Remove or prefix with `_` any unused mock data

**Common TypeScript errors in tests:**
```typescript
// ❌ Bad: 'data' is of type 'unknown'
const data = await res.json();
expect(data.error).toBe('Error');

// ✅ Good: Type assertion
const data = (await res.json()) as { error: string };
expect(data.error).toBe('Error');

// ❌ Bad: Unused imports cause TS6133 errors
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono'; // Not used!

// ✅ Good: Only import what you use
import { describe, test, expect, mock, beforeEach } from 'bun:test';
```

## Final Verification

Before marking task as complete:

```bash
# Full verification command
bun run lint && bun run typecheck && bun test && git status
```

Expected outcome:
- ✅ 0 lint warnings
- ✅ 0 type errors
- ✅ All tests passing
- ✅ All changes staged or committed

## Environment-Specific Testing

If changes affect infrastructure abstraction:

```bash
# Test with PostgreSQL (default)
DB_TYPE=postgres bun run backend:dev

# Test with SQLite
DB_TYPE=sqlite DATABASE_URL="sqlite://./test.db" bun run backend:dev

# Test with local storage
STORAGE_TYPE=local bun run backend:dev
```

## Documentation Updates

If changes affect:
- **Public API**: Update API documentation
- **Configuration**: Update `.env.example` and README
- **Architecture**: Update relevant docs in `docs/` directory
- **Dependencies**: Update `package.json` version if needed
