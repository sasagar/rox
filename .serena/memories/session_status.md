# Session Status - 2025-12-14 (Updated)

## Current Release: v2025.12.2

### Overall Status: ✅ STABLE RELEASE

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript type check | ✅ Pass | All packages pass |
| Linting (oxlint) | ✅ Pass | 0 warnings, 0 errors |
| Unit tests | ✅ Pass | 841+ tests passing |
| Build | ✅ Pass | Backend and frontend build successfully |
| Translations | ✅ Complete | 1173 strings, 0 missing in Japanese |
| Docker configs | ✅ Ready | compose.yml, compose.dev.yml configured |
| DevContainer | ✅ Ready | Full setup with HTTPS, Claude Code |

### Package Versions
- Root: `2025.12.2` (CalVer)
- packages/backend: `1.1.0` (SemVer)
- packages/frontend: `1.1.0` (SemVer)
- packages/shared: `1.1.0` (SemVer)

## Recent Changes (v2025.12.2)

### List Member Management (PR #71, merged)
- **AddMemberModal**: New modal for searching and adding users to lists
- **ListMembersModal**: Extended with "Add member" button
- **MFM Emoji Support**: User display names now render custom emojis
- **Sidebar Navigation**: Lists sidebar with "Back to lists" link

### Bug Fixes
- **Lingui SSG Warning Fix**: Added `@lingui/message-utils` with `setMessagesCompiler()` to suppress "Uncompiled message detected" warnings during Waku static site generation
- **User Profile Back Button**: Added back navigation button on profile banner

### Files Changed in v2025.12.2
- `packages/frontend/src/components/list/AddMemberModal.tsx` (new)
- `packages/frontend/src/components/list/ListMembersModal.tsx` (updated)
- `packages/frontend/src/components/list/ListMemberCard.tsx` (updated)
- `packages/frontend/src/components/user/UserProfile.tsx` (back button added)
- `packages/frontend/src/lib/i18n/index.ts` (message compiler)
- `packages/frontend/package.json` (`@lingui/message-utils` added)

## Development Environment

```bash
# Standard dev command
DB_TYPE=postgres \
DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" \
STORAGE_TYPE=local LOCAL_STORAGE_PATH=./uploads \
PORT=3000 NODE_ENV=development URL=http://localhost:3000 \
bun run dev
```

## Frontend Development

```bash
cd packages/frontend
bun run dev  # Runs on port 3001
```

## Key Features

- ActivityPub federation (Follow, Create, Like, Announce, Delete, Move)
- Misskey-compatible API endpoints
- Multi-database support (PostgreSQL, MySQL, SQLite/D1)
- S3-compatible storage support
- Redis/Dragonfly caching
- BullMQ job queue for async delivery
- Role-based access control (Admin, Moderator)
- User moderation (warnings, suspensions, reports)
- Account migration support (Move activity)
- Custom emoji management
- MFM (Misskey Flavored Markdown) support
- List feature (create, manage, timeline)
- Web Push notifications

## Potential Next Steps
1. Performance optimizations (query caching, response optimization)
2. Plugin architecture implementation (design complete in memory)
3. Image optimization improvements
4. Mobile UX refinements
