# Rox Project Overview

## What is Rox?

**Rox** is a lightweight ActivityPub server & client designed to be:
- **Lighter and faster** than existing Misskey instances
- **Infrastructure agnostic** - runs on VPS (Docker) or edge environments (Cloudflare Workers/D1)
- **Misskey API compatible** for seamless migration

## Component Names

- **Backend**: Hono Rox (`packages/backend`)
- **Frontend**: Waku Rox (`packages/frontend`)
- **Shared**: Common utilities (`packages/shared`)

## Monorepo Structure

```
rox/
├── packages/
│   ├── backend/    # Hono-based ActivityPub server
│   ├── frontend/   # Waku-based React client
│   └── shared/     # Shared types and utilities
├── docker/         # Docker configuration
├── docs/           # Documentation
└── .github/        # CI workflows
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

## Development Status

- **Phase 0**: Foundation ✅
- **Phase 1**: Misskey-Compatible API ✅
- **Phase 2**: Frontend (Waku Client) ✅
- **Phase 3**: ActivityPub Federation ✅
- **Phase 4**: Optimization (Redis caching) ✅
- **Phase 5**: Administration & Security ✅
- **Phase 6**: Polish & UX (In Progress)
