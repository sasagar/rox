# Rox Implementation Plan

This directory contains implementation plans and progress tracking documents for the Rox project.

**Languages**: English | [日本語](./README.md)

## Document Structure

- [overview.md](./overview.md) - Project overview and implementation approach
- [phase-0-foundation.md](./phase-0-foundation.md) - Phase 0: Foundation
- [phase-1-api.md](./phase-1-api.md) - Phase 1: Misskey-Compatible API
- [phase-2-frontend.md](./phase-2-frontend.md) - Phase 2: Frontend Implementation
- [phase-3-federation.md](./phase-3-federation.md) - Phase 3: ActivityPub Federation
- [decisions.md](./decisions.md) - Important technical decisions
- [timeline.md](./timeline.md) - Implementation timeline and milestones

## Implementation Status

| Phase | Status | Completion | Notes |
|-------|--------|------------|-------|
| Phase 0: Foundation | ✅ Complete | 100% | All foundation components implemented and tested |
| Phase 1: Misskey API | ✅ Complete | 100% | All core endpoints implemented and verified |
| Phase 2: Frontend | ✅ Complete | 100% | Waku Client fully implemented (including accessibility) |
| Phase 3: Federation | ✅ Complete | 100% | ActivityPub federation operational |
| Phase 4: Refactoring | ✅ Complete | 100% | Code optimization and test coverage |
| Phase 5: Administration | ✅ Complete | 100% | Role system and moderation tools |
| Phase 6: Production | ✅ Complete | 100% | Production deployment ready |

## Recent Implementation

### Phase 0 (Complete)
- ✅ Bun workspace monorepo structure
- ✅ TypeScript strict mode configuration
- ✅ oxc configuration (linting and formatting)
- ✅ Docker Compose (PostgreSQL/Dragonfly)
- ✅ Drizzle ORM schema definitions (6 tables)
- ✅ Repository Pattern implementation (6 repositories)
- ✅ Storage Adapter Pattern implementation (Local/S3)
- ✅ DI container and middleware
- ✅ Database migrations

### Phase 1 (Complete - 2025-11-19)

**Authentication & Session Management:**
- ✅ Password hashing utilities (Argon2id)
- ✅ Session management utilities (CSPRNG)
- ✅ Authentication service (register, login, logout, session validation)
- ✅ Authentication middleware (optionalAuth/requireAuth)
- ✅ User registration, login, logout API endpoints

**User Management:**
- ✅ Profile get/update (/api/users/@me, PATCH /api/users/@me)
- ✅ User info retrieval (/api/users/:id)
- ✅ Misskey-compatible endpoints (/api/users/show?userId/username)
- ✅ Follow/unfollow functionality
- ✅ Followers/following lists (with pagination)

**File Management:**
- ✅ File upload, delete, update (/api/drive/files/*)
- ✅ Storage usage calculation (/api/drive/usage)
- ✅ Metadata management (isSensitive, comment)
- ✅ MD5 hash calculation

**Note Features:**
- ✅ Note create, read, delete
- ✅ Timelines (local, home, user)
- ✅ File attachments (up to 4 files/note)
- ✅ Mention, hashtag, emoji extraction
- ✅ Reply and Renote support
- ✅ Visibility control (public/home/followers/specified)

**Reactions:**
- ✅ Reaction create/delete
- ✅ Reaction counts and listings
- ✅ Unicode emoji and custom emoji support

### Phase 2 (Complete - 2025-11-25)

**Environment Setup:**
- ✅ Waku 0.27.1 + Jotai setup
- ✅ Tailwind CSS v4 + OKLCH color space custom colors
- ✅ Lingui i18n support (Japanese/English, 127 messages)
- ✅ React Aria Components integration
- ✅ Lucide React icon library integration

**Authentication Flow:**
- ✅ Login/Signup pages
- ✅ Passkey authentication (WebAuthn)
- ✅ Password authentication
- ✅ Session management (localStorage persistence)

**Timeline Features:**
- ✅ Local/Social/Home timeline display
- ✅ Infinite scroll (Intersection Observer + custom hooks)
- ✅ Skeleton loading, error display
- ✅ Timeline tab switching

**Post Features (NoteComposer):**
- ✅ Text posting, image attachments (multiple support)
- ✅ Drag & drop file uploads
- ✅ Image preview display
- ✅ Reply, renote functionality
- ✅ CW (Content Warning) support
- ✅ Visibility settings (React Aria Select with icons, i18n)
- ✅ File upload progress display

**Post Display (NoteCard):**
- ✅ Reaction display, add, remove (ReactionPicker, icon buttons)
- ✅ Renote functionality (Lucide Repeat2 icon)
- ✅ Reply functionality (Lucide MessageCircle icon)
- ✅ Follow/Unfollow button
- ✅ Image modal (zoom, pan, gallery navigation)
- ✅ Post deletion
- ✅ Content Warning expansion

**User Profile Page:**
- ✅ Profile information display (avatar, banner, bio)
- ✅ Statistics (posts, followers, following)
- ✅ Follow/Unfollow button
- ✅ User posts list
- ✅ Dynamic routing (`/[username]`)

**UI/UX Improvements:**
- ✅ Loading indicators (Spinner, ProgressBar, Skeleton)
- ✅ Error display and retry functionality
- ✅ Image fullscreen modal (Lucide icons)
- ✅ Responsive design
- ✅ Icon system unification (Lucide React, migrated from Unicode emoji)
- ✅ Custom components (EmojiPicker, ImageModal, ReactionPicker)

**Accessibility:**
- ✅ Keyboard navigation (j/k, arrow keys, Home/End)
- ✅ Focus management (modal focus trapping)
- ✅ Proper ARIA attributes (role, aria-label, aria-expanded, etc.)
- ✅ Screen reader support (sr-only class usage)

### Phase 3 (Complete - 2025-11)

**ActivityPub Federation:**
- ✅ WebFinger (RFC 7033 compliant)
- ✅ Actor documents (Person, JSON-LD)
- ✅ HTTP Signatures (RSA-SHA256, hs2019)
- ✅ Inbox handlers (11 activity types)
- ✅ Outbox & Collections
- ✅ Activity delivery queue (BullMQ + Dragonfly)
- ✅ Shared inbox support
- ✅ Per-server rate limiting
- ✅ Activity deduplication
- ✅ Delivery metrics & monitoring

## Quick Links

- [Project Specification](../project/v1.md)
- [Developer Guide](../../CLAUDE.md)
- [Setup Instructions](../../README.md)

## Progress Updates

This document is updated as implementation progresses.

**Last Updated:** 2025-11-25
**Current Phase:** Phase 6 Complete ✅
**Next Milestone:** Phase 7 (Plugin System) - Planning

## Archive

Historical task summaries and planning documents are available in the [archive](./archive/) directory.
