# Contributing to Rox

Thank you for your interest in contributing to Rox! This document provides guidelines for contributing to the project.

**Languages**: English | [日本語](./CONTRIBUTING.ja.md)

## Code of Conduct

Be respectful and constructive in all interactions. We aim to maintain a welcoming and inclusive community.

## Development Setup

See [README.md](./README.md) for initial setup instructions.

### Additional Development Tools

```bash
# Type checking
bun run typecheck

# Linting
bun run lint

# Formatting
bun run format

# Run all checks
bun run lint && bun run typecheck && bun test
```

## Documentation Standards

### TSDoc Comments

All TSDoc comments (`/** */`) **MUST** be written in English:

```typescript
/**
 * Hash a password using Argon2id
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecretPassword123');
 * ```
 *
 * @remarks
 * - Algorithm: argon2id
 * - Memory cost: 19456 KiB
 */
export async function hashPassword(password: string): Promise<string> {
  // Implementation...
}
```

**Required Elements:**
- Module-level description (`@module`)
- Function/method description
- Parameter descriptions (`@param`)
- Return value description (`@returns`)
- Exceptions (`@throws`) when applicable
- Usage examples (`@example`) for public APIs
- Implementation notes (`@remarks`) when helpful

### Inline Comments

Inline comments (`//` or `/* */`) MAY be in Japanese or English:

```typescript
// ユーザーごとのディレクトリに保存
const relativePath = join(metadata.userId, filename);

// Save to user-specific directory
const relativePath = join(metadata.userId, filename);
```

### Checking Documentation

**VSCode/Cursor**: Hover over functions to see TSDoc tooltips

**Generate Documentation**:
```bash
# Install TypeDoc
bun add -d typedoc

# Generate documentation
bunx typedoc --out docs/api packages/backend/src
```

**Check for Missing Documentation**:
```bash
# Use TSDoc ESLint plugin (optional)
bun add -d eslint-plugin-tsdoc
```

## Code Style

### TypeScript

- Use **strict mode** (already configured)
- Prefer `interface` over `type` for object shapes
- Use `type` for unions and intersections
- Always specify return types for public functions
- Use meaningful variable names (avoid single letters except in loops)

### Formatting

We use **oxc** for linting and formatting:

```bash
# Auto-fix formatting issues
bun run format

# Check for issues
bun run lint
```

### File Naming

- **PascalCase**: Classes, interfaces, types (`UserRepository.ts`)
- **camelCase**: Functions, variables, files with multiple exports (`session.ts`)
- **kebab-case**: Configuration files (`docker-compose.yml`)

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user registration endpoint
fix: resolve session expiration bug
docs: update API documentation
refactor: simplify password hashing logic
test: add authentication service tests
chore: update dependencies
```

**Format**: `<type>(<scope>): <subject>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Release Notes Generation

Commit messages are automatically categorized in release notes based on their type prefix. The release notes are generated when a new version is tagged.

**Category Mapping**:

| Prefix | Release Notes Section |
|--------|----------------------|
| `feat` | 🚀 New Features |
| `fix` | 🐛 Bug Fixes |
| `perf` | ⚡ Performance |
| `docs` | 📚 Documentation |
| `chore` | 🧰 Maintenance |
| `refactor` | ♻️ Refactoring |
| Other | 📝 Other Changes |

**Best Practices for Release Notes**:

1. **Start with the type prefix**: Your commit message MUST start with the type prefix (e.g., `feat:`, `fix:`) to be categorized correctly
2. **Write clear subjects**: The subject line appears directly in release notes, so make it descriptive
3. **Use scope for context**: Optional scope helps identify the affected area (e.g., `feat(auth):`, `fix(api):`)
4. **Your name is included**: The git author name is automatically added to each entry

**Examples**:

```bash
# Good - will appear in "🚀 New Features"
feat(auth): add OAuth2 login support

# Good - will appear in "🐛 Bug Fixes"
fix(timeline): resolve infinite scroll issue on mobile

# Good - will appear in "⚡ Performance"
perf(db): optimize user lookup queries

# Bad - will appear in "📝 Other Changes" (missing type prefix)
added new feature for user profiles
```

## Pull Request Process

1. **Create a feature branch**: `git checkout -b feat/your-feature`
2. **Make your changes**: Follow the code style and documentation standards
3. **Run all checks**: `bun run lint && bun run typecheck && bun test`
4. **Commit your changes**: Use conventional commit messages
5. **Push to your fork**: `git push origin feat/your-feature`
6. **Open a Pull Request**: Provide a clear description of the changes

### PR Description Template

See [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) for the full template. Key sections include:

- **Summary**: Brief description of changes
- **Type of Change**: Bug fix, new feature, breaking change, documentation, refactoring, performance, test, or CI/CD
- **Related Issues**: Link using "Fixes #123" or "Closes #123"
- **Changes**: List main changes
- **Test Plan**: Unit tests, integration tests, manual testing
- **Checklist**: Style guidelines, self-review, comments, documentation, warnings, tests

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/services/AuthService.test.ts

# Run tests in watch mode
bun test --watch
```

### Writing Tests

```typescript
import { describe, test, expect } from 'bun:test';

describe('AuthService', () => {
  test('should hash password correctly', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);

    expect(hash).toStartWith('$argon2id$');
    expect(await verifyPassword(password, hash)).toBe(true);
  });
});
```

## Architecture Patterns

### Repository Pattern

Database operations must go through repository interfaces:

```typescript
// ✅ Good
const user = await userRepository.findById(userId);

// ❌ Bad
const user = await db.select().from(users).where(eq(users.id, userId));
```

### Adapter Pattern

Storage operations must use adapters:

```typescript
// ✅ Good
const url = await storageAdapter.save(file, metadata);

// ❌ Bad
await fs.writeFile(path, file);
```

### Dependency Injection

Use Hono Context for dependency injection:

```typescript
app.post('/api/notes', requireAuth(), async (c) => {
  const noteRepository = c.get('noteRepository');
  const user = c.get('user')!;

  const note = await noteRepository.create({
    userId: user.id,
    text: body.text,
  });

  return c.json(note);
});
```

## Database Migrations

### Creating Migrations

```bash
# 1. Update schema in src/db/schema/pg.ts
# 2. Generate migration
bun run db:generate

# 3. Review generated migration in drizzle/postgres/
# 4. Run migration
bun run db:migrate
```

### Migration Guidelines

- Always test migrations on a copy of production data
- Ensure migrations are reversible when possible
- Document complex migrations in the migration file
- Never modify existing migrations that have been deployed

## Questions?

- Check existing issues and discussions
- Ask in the project discussions
- Refer to [Implementation Guide](./docs/implementation/README.md) for architectural details

## License

By contributing, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
