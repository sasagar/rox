# Phase 5: Refactoring & Optimization Plan

**Created:** 2025-11-26
**Updated:** 2025-11-26
**Status:** In Progress (Sprint 5 - Unit Tests & DI Enhancement)

## Overview

Phase 5 focuses on code quality improvements, performance optimizations, and test coverage expansion before adding new features.

---

## 1. Code Refactoring

### 1.1 Inbox Handler Extraction (High Priority) ✅ COMPLETE

**Before:**
- [inbox.ts](../../packages/backend/src/routes/ap/inbox.ts) contained 756 lines
- All 10 activity handlers in a single file
- Each handler instantiated `RemoteActorService` directly

**After:**
```
services/ap/inbox/
├── InboxService.ts           # Main dispatcher (140 lines)
├── types.ts                  # Shared types (126 lines)
├── index.ts                  # Exports (21 lines)
└── handlers/
    ├── BaseHandler.ts        # Abstract base class (131 lines)
    ├── FollowHandler.ts      # (89 lines)
    ├── AcceptHandler.ts      # (56 lines)
    ├── RejectHandler.ts      # (27 lines)
    ├── CreateHandler.ts      # (59 lines)
    ├── UpdateHandler.ts      # (163 lines)
    ├── DeleteHandler.ts      # (64 lines)
    ├── LikeHandler.ts        # (83 lines)
    ├── AnnounceHandler.ts    # (90 lines)
    ├── UndoHandler.ts        # (151 lines)
    └── index.ts              # Handler exports (18 lines)

routes/ap/inbox.ts            # Route only (140 lines, down from 756)
```

**Tasks:**
- [x] Create `BaseHandler` abstract class with common dependencies
- [x] Extract each `handle*` function into separate handler class
- [x] Create `InboxService` as dispatcher
- [x] Update `routes/ap/inbox.ts` to use `InboxService`
- [ ] Add unit tests for each handler (deferred to 4.1)

**Results:**
- inbox.ts reduced from **756 → 140 lines** (81% reduction)
- Each handler is now independently testable
- Handler registration is extensible via `InboxService.registerHandler()`

**Estimated Impact:** High maintainability improvement ✅ Achieved

---

### 1.2 ActivityPubDeliveryService Refactoring (Medium Priority) ✅ COMPLETE

**Before:**
- [ActivityPubDeliveryService.ts](../../packages/backend/src/services/ap/ActivityPubDeliveryService.ts) contained 633 lines
- 9 `deliver*` methods with duplicated activity construction logic

**After:**
```
services/ap/delivery/
├── ActivityBuilder.ts        # Activity construction (319 lines)
└── index.ts                  # Exports

ActivityPubDeliveryService.ts # Simplified to 276 lines (56% reduction)
```

**Tasks:**
- [x] Extract `ActivityBuilder` for activity JSON construction
- [x] Create helper methods (`enqueueDelivery`, `deliverToInboxes`, `getRemoteFollowers`)
- [x] Simplify all 9 `deliver*` methods to use shared logic
- [ ] Add unit tests (deferred to 4.1)

**Results:**
- ActivityPubDeliveryService.ts reduced from **633 → 276 lines** (56% reduction)
- ActivityBuilder provides reusable activity construction
- Each delivery method is now 10-20 lines instead of 40-100 lines

**Estimated Impact:** Medium maintainability improvement ✅ Achieved

---

### 1.3 DI Container Enhancement (Medium Priority) ✅ COMPLETE

**Current State:**
- ✅ `RemoteActorService` now in DI container
- ✅ `RemoteNoteService` now in DI container
- ✅ `ActivityPubDeliveryService` now in DI container

**Tasks:**
- [x] Add `RemoteActorService` to DI container
- [x] Add `RemoteNoteService` to DI container
- [x] Add `ActivityPubDeliveryService` to DI container
- [x] Update all usages to get services from context

**Implementation:**
```
di/container.ts              # Added remoteActorService, remoteNoteService, activityPubDeliveryService
middleware/di.ts             # Inject all services into Hono Context
services/ap/RemoteNoteService.ts  # Accept RemoteActorService via constructor
services/UserService.ts      # Accept ActivityPubDeliveryService via constructor
services/NoteService.ts      # Accept ActivityPubDeliveryService via constructor
services/ReactionService.ts  # Accept ActivityPubDeliveryService via constructor
routes/users.ts              # Use injected services
routes/notes.ts              # Use injected activityPubDeliveryService
routes/reactions.ts          # Use injected activityPubDeliveryService
routes/following.ts          # Use injected activityPubDeliveryService
handlers/BaseHandler.ts      # Added getRemoteActorService(), getRemoteNoteService()
handlers/CreateHandler.ts    # Use getRemoteNoteService()
handlers/AnnounceHandler.ts  # Use getRemoteNoteService()
```

**Estimated Impact:** Better testability, consistent patterns ✅ Achieved

---

### 1.4 Dynamic Import Cleanup (Low Priority) ✅ COMPLETE

**Before:**
- `await import('shared')` used in multiple handler files
- `await import('blurhash')` in ImageProcessor
- `await import('drizzle-orm')` in inbox.ts

**After:**
- All dynamic imports converted to top-level imports
- `generateId()` changed from async to sync method

**Files Updated:**
- `handlers/BaseHandler.ts` - Top-level import from 'shared'
- `handlers/LikeHandler.ts` - Updated to sync generateId()
- `handlers/AnnounceHandler.ts` - Updated to sync generateId()
- `handlers/FollowHandler.ts` - Updated to sync generateId()
- `services/ImageProcessor.ts` - Top-level import of blurhash
- `routes/ap/inbox.ts` - Top-level import of drizzle-orm

**Estimated Impact:** Minor code cleanliness ✅ Achieved

---

## 2. Performance Optimization

### 2.1 Dragonfly Caching (High Priority) ✅ COMPLETE

**Target Areas:**
1. **Public Timeline Cache** ✅
   - Cache public timeline results for 30 seconds
   - Invalidate on new local note creation

2. **User Profile Cache** ✅
   - Cache user profiles for 5 minutes (CacheTTL.MEDIUM)
   - Invalidate on profile update
   - Cache by ID (`findById`) and username (`findByUsername`)

3. **Remote Actor Cache**
   - Already partially implemented
   - Extend TTL and add cache warming (planned)

**Tasks:**
- [x] Create `ICacheService` interface (`interfaces/ICacheService.ts`)
- [x] Implement Dragonfly adapter (`adapters/cache/DragonflyCacheAdapter.ts`)
- [x] Add caching to `NoteService.getLocalTimeline()` (30s TTL for first page)
- [x] Add cache invalidation on note creation
- [x] Add `cacheService` to DI Container
- [x] Add caching to `UserService.findById()` and `findByUsername()`
- [x] Add cache invalidation on profile update

**Implementation Details:**
```
interfaces/ICacheService.ts          # Cache interface
adapters/cache/DragonflyCacheAdapter.ts  # Dragonfly implementation with TTL constants
di/container.ts                      # Added cacheService to AppContainer
middleware/di.ts                     # Inject cacheService into Hono Context
services/NoteService.ts              # Added timeline caching + invalidation
services/UserService.ts              # Added profile caching + invalidation
routes/notes.ts                      # Pass cacheService to NoteService
routes/users.ts                      # Pass cacheService to UserService
```

**Cache Configuration:**
- `CacheTTL.SHORT` (30s) - Timeline cache
- `CacheTTL.MEDIUM` (5min) - User profiles
- `CacheTTL.LONG` (1hr) - Rarely changing data
- `CacheTTL.DAY` (24hr) - Static data

**Estimated Impact:** High performance improvement for read-heavy operations ✅ Achieved

---

### 2.2 Database Connection Pooling (Medium Priority) ✅ COMPLETE

**Implementation:**
```typescript
// db/index.ts - postgres.js connection pooling configuration
const client = postgres(databaseUrl, {
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20', 10),
  max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || '1800', 10),
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '30', 10),
});
```

**Environment Variables:**
- `DB_POOL_MAX` - Max connections (default: 10)
- `DB_IDLE_TIMEOUT` - Idle timeout in seconds (default: 20)
- `DB_MAX_LIFETIME` - Max connection lifetime (default: 1800 = 30min)
- `DB_CONNECT_TIMEOUT` - Connection timeout (default: 30s)

**Tasks:**
- [x] Review Drizzle ORM connection pool settings
- [x] Configure appropriate pool size for PostgreSQL
- [ ] Add connection pool monitoring (future enhancement)

---

### 2.3 Query Optimization (Low Priority) ✅ COMPLETE

**Analysis Results:**
- N+1 queries already avoided via `innerJoin` in timeline methods
- Existing indexes cover basic queries

**New Composite Indexes Added:**
```sql
-- User timeline: faster retrieval of user's notes ordered by time
CREATE INDEX note_user_timeline_idx ON notes(user_id, created_at);

-- Local timeline: faster public timeline queries
CREATE INDEX note_local_timeline_idx ON notes(visibility, local_only, created_at);
```

**Tasks:**
- [x] Analyze slow queries with EXPLAIN
- [x] Add missing indexes if needed
- [x] Verify N+1 queries in timeline fetching (already using JOINs)

---

## 3. Image Processing

### 3.1 WebP Conversion (Medium Priority) ✅ COMPLETE

**Tasks:**
- [x] Add sharp library for image processing
- [x] Convert uploaded images to WebP
- [x] Generate thumbnails for timeline display
- [x] Generate blurhash for progressive loading

**Implementation:**
```
services/ImageProcessor.ts          # Image processing with sharp (220 lines)
  - WebP conversion (quality: 80, max: 2048x2048)
  - Thumbnail generation (400x400 cover crop)
  - Blurhash generation for progressive loading
  - Fallback to original on processing failure

services/FileService.ts             # Updated upload method
  - Automatic WebP conversion for all images
  - Thumbnail saved alongside main file
  - Blurhash stored in database
```

**Supported Formats:**
- JPEG, PNG, GIF, WebP, AVIF, HEIF/HEIC, TIFF

### 3.2 Media Proxy (Low Priority) ✅ COMPLETE

**Implementation:**
```
routes/proxy.ts                      # Media proxy endpoint (230 lines)
  GET /proxy?url=<encoded-url>       # Proxy remote media with caching
  GET /proxy/avatar?url=<url>        # Avatar proxy with fallback
```

**Features:**
- Remote media caching via Dragonfly (24h TTL)
- Content-type validation (images, audio, video)
- File size limit (10MB)
- Private IP blocking for security
- Request timeout (10s)
- Cache headers for browser caching

**Tasks:**
- [x] Design media proxy endpoint
- [x] Cache remote media locally
- [x] Add content-type validation

---

## 4. Test Coverage

### 4.1 Unit Tests (High Priority) - IN PROGRESS

**Current Coverage:**
- `ReactionService.test.ts` - 9 tests
- `NoteService.test.ts` - 20 tests ✅ NEW
- `ImageProcessor.test.ts` - 19 tests ✅ NEW
- `FollowService.test.ts` - 20 tests ✅ NEW
- `AuthService.test.ts` - 14 tests ✅ NEW
- `UserService.test.ts` - 16 tests ✅ (added 5 cache tests)
- **Total: 98 unit tests**

**Target Services:**
- [x] `NoteService` - create, delete, timeline methods
- [x] `ImageProcessor` - WebP conversion, thumbnail generation
- [x] `FollowService` - follow, unfollow, getFollowers, getFollowing, counts
- [x] `AuthService` - register, login, logout, validateSession
- [x] `UserService` - updateProfile, findById, findByUsername, caching

### 4.2 Integration Tests (Medium Priority)

**Tasks:**
- [ ] Expand `api-endpoints.test.ts`
- [ ] Add ActivityPub inbox tests
- [ ] Add delivery queue tests

### 4.3 GitHub Actions CI ✅ COMPLETE

**Implementation:**
```
.github/workflows/ci.yml
  - lint-and-typecheck: TypeScript type checking
  - test: Unit tests (src/tests/unit/)
  - build: Backend and frontend builds
```

**Triggers:**
- Push to main branch
- Pull requests to main branch

---

## Implementation Order

### Sprint 1: Foundation (Week 1) ✅ COMPLETE
1. ✅ Create refactoring plan
2. ✅ Inbox handler extraction (1.1) - **COMPLETE**
3. Add unit tests for handlers (deferred to Sprint 3)

### Sprint 2: DI & Caching (Week 2) ✅ COMPLETE
4. ✅ DI container enhancement - Added `cacheService` to AppContainer
5. ✅ Dragonfly caching implementation (2.1) - **COMPLETE**
   - Created `ICacheService` interface
   - Implemented `DragonflyCacheAdapter`
   - Added timeline caching to `NoteService.getLocalTimeline()`
   - Added cache invalidation on note creation

### Sprint 3: Delivery Refactoring (Week 3) ✅ COMPLETE
6. ✅ ActivityPubDeliveryService refactoring (1.2) - **COMPLETE**
   - Created `ActivityBuilder` for reusable activity construction
   - Reduced ActivityPubDeliveryService from 633 → 276 lines
7. Unit test expansion (4.1) - deferred

### Sprint 4: Optimization (Week 4) ✅ COMPLETE
9. ✅ Image processing (3.1) - **COMPLETE**
   - Added sharp and blurhash libraries
   - Created `ImageProcessor` service
   - WebP conversion with thumbnail generation
   - Blurhash for progressive loading
10. ✅ Query optimization (2.3) - **COMPLETE**
    - Added composite indexes for timeline queries
    - Verified N+1 avoidance via JOINs
11. Integration tests (4.2) - deferred

### Sprint 5: DI & Unit Tests (Week 5) - IN PROGRESS
1. ✅ DI Container Enhancement (1.3) - **MOSTLY COMPLETE**
   - Added `RemoteActorService` to DI container
   - Added `RemoteNoteService` to DI container
   - Updated handlers to use injected services
2. ✅ Database Connection Pooling (2.2) - **COMPLETE**
   - Configured postgres.js pooling options
   - Added environment variable configuration
3. ✅ FollowService unit tests - **COMPLETE** (20 tests)
4. ✅ AuthService unit tests - **COMPLETE** (14 tests)
5. ✅ UserService unit tests - **COMPLETE** (16 tests, including cache tests)
6. ✅ User Profile Cache - **COMPLETE**

---

## Success Metrics

| Metric | Before | Current | Target | Status |
|--------|--------|---------|--------|--------|
| inbox.ts lines | 756 | 140 | <200 | ✅ Achieved |
| ActivityPubDeliveryService lines | 633 | 276 | <300 | ✅ Achieved |
| Unit test files | 2 | 6 | 10+ | In Progress |
| Unit test count | 9 | 98 | 100+ | Almost There! |
| Test coverage | ~5% | ~28% | 40%+ | In Progress |
| Timeline response time (p95) | TBD | TBD | <100ms | Pending |

---

## Risk Mitigation

1. **Breaking Changes**: Run full test suite after each refactoring step
2. **Federation Compatibility**: Test with Mastodon/Misskey after inbox changes
3. **Performance Regression**: Benchmark before/after caching implementation

---

## Notes

- All refactoring should maintain backward compatibility
- New code must follow existing patterns (Repository, Adapter)
- TSDoc comments required for new public APIs
