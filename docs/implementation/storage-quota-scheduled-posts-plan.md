# Implementation Plan: Storage Management, Quotas, and Scheduled Posts

## Overview

This plan covers three related feature requests:
1. **User Storage Management** - Per-user upload storage with moderator access controls
2. **Storage Quota System** - Per-user/role storage limits with permission management
3. **Scheduled Posts** - Users can schedule posts with role-based limits

---

## Feature 1: User Storage Management

### Requirements
- Per-user upload storage (already exists via `userId` on `driveFiles`)
- System-acquired data viewable by moderators separately
- Admin controls whether moderators can handle this

### Implementation

#### 1.1 Database Changes

Add `source` field to `driveFiles` table to distinguish user uploads from system-acquired data:

```typescript
// In packages/backend/src/db/schema/pg.ts - driveFiles table
source: text("source").notNull().default("user"), // "user" | "system"
```

#### 1.2 RolePolicies Updates

Add new policy flag:

```typescript
// In RolePolicies interface
canViewSystemAcquiredFiles?: boolean; // Moderator permission to view system files
```

#### 1.3 API Endpoints

- `GET /api/admin/files/system` - List system-acquired files (moderator+)
- `GET /api/admin/files/user/:userId` - List user's files (moderator+)
- Update existing `/api/drive` endpoints to filter by source

#### 1.4 Frontend Changes

- Add "System Files" tab in moderator panel
- Add file source indicator in file management UI

---

## Feature 2: Storage Quota System

### Requirements
- Storage limits per role (via `driveCapacityMb` in policies - already exists)
- Storage limits per user (individual override)
- Only server admin + authorized users can change quotas
- Admin can grant quota management permission to users/roles

### Implementation

#### 2.1 Database Changes

Add `storageQuotaOverride` to `users` table for individual user quotas:

```typescript
// In packages/backend/src/db/schema/pg.ts - users table
storageQuotaMb: integer("storage_quota_mb"), // null = use role default, -1 = unlimited
```

#### 2.2 RolePolicies Updates

Add new permission:

```typescript
// In RolePolicies interface
canManageStorageQuotas?: boolean; // Permission to change user/role storage quotas
```

Update `DEFAULT_POLICIES`:
```typescript
canManageStorageQuotas: false,
```

#### 2.3 RoleService Updates

Add method to get effective storage quota:

```typescript
async getStorageQuota(userId: string): Promise<number> {
  // 1. Check user's individual override
  // 2. Fall back to role-based driveCapacityMb
  // 3. Fall back to DEFAULT_POLICIES.driveCapacityMb
}
```

#### 2.4 FileService Updates

Add quota check in `upload` method:

```typescript
async upload(input: FileUploadInput): Promise<DriveFile> {
  // Check storage quota before upload
  const currentUsage = await this.driveFileRepository.getTotalSize(userId);
  const quota = await this.roleService.getStorageQuota(userId);

  if (quota !== -1 && currentUsage + file.byteLength > quota * 1024 * 1024) {
    throw new QuotaExceededError("Storage quota exceeded");
  }

  // ... existing upload logic
}
```

#### 2.5 API Endpoints

- `GET /api/users/:id/storage` - Get user's storage usage and quota
- `PATCH /api/admin/users/:id/storage-quota` - Set user's individual quota (admin + canManageStorageQuotas)
- Update role management endpoints to handle new policy

#### 2.6 Frontend Changes

- Add storage usage display in user settings
- Add quota management in admin user panel
- Add quota policy field in role editor

---

## Feature 3: Scheduled Posts

### Requirements
- Users can schedule posts for future publication
- Maximum number of scheduled posts set by admin via roles
- Scheduled posts are published automatically at the specified time

### Implementation

#### 3.1 Database Changes

Create new `scheduledNotes` table:

```typescript
export const scheduledNotes = pgTable(
  "scheduled_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Note content (same as notes table)
    text: text("text"),
    cw: text("cw"),
    visibility: text("visibility").notNull().default("public"),
    localOnly: boolean("local_only").notNull().default(false),
    replyId: text("reply_id"),
    renoteId: text("renote_id"),
    fileIds: jsonb("file_ids").$type<string[]>().notNull().default([]),
    // Schedule info
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: text("status").notNull().default("pending"), // pending, published, failed, cancelled
    publishedNoteId: text("published_note_id"), // ID of created note after publishing
    errorMessage: text("error_message"), // Error if publication failed
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("scheduled_note_user_id_idx").on(table.userId),
    scheduledAtIdx: index("scheduled_note_scheduled_at_idx").on(table.scheduledAt),
    statusIdx: index("scheduled_note_status_idx").on(table.status),
    // Composite for efficient queue processing
    pendingScheduleIdx: index("scheduled_note_pending_schedule_idx").on(
      table.status,
      table.scheduledAt,
    ),
  }),
);
```

#### 3.2 RolePolicies Updates

Add scheduled post limit:

```typescript
// In RolePolicies interface
maxScheduledNotes?: number; // Maximum concurrent scheduled notes, -1 = unlimited, 0 = disabled
```

Update `DEFAULT_POLICIES`:
```typescript
maxScheduledNotes: 10,
```

#### 3.3 Repository: IScheduledNoteRepository

```typescript
export interface IScheduledNoteRepository {
  create(input: NewScheduledNote): Promise<ScheduledNote>;
  findById(id: string): Promise<ScheduledNote | null>;
  findByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<ScheduledNote[]>;
  countPendingByUserId(userId: string): Promise<number>;
  findPendingToPublish(before: Date, limit: number): Promise<ScheduledNote[]>;
  update(id: string, input: Partial<ScheduledNote>): Promise<ScheduledNote | null>;
  delete(id: string): Promise<boolean>;
}
```

#### 3.4 Service: ScheduledNoteService

```typescript
export class ScheduledNoteService {
  async create(userId: string, input: ScheduledNoteInput): Promise<ScheduledNote> {
    // Check if user has reached max scheduled notes limit
    const currentCount = await this.scheduledNoteRepository.countPendingByUserId(userId);
    const maxAllowed = await this.roleService.getMaxScheduledNotes(userId);

    if (maxAllowed === 0) {
      throw new Error("Scheduled notes are disabled for your account");
    }
    if (maxAllowed !== -1 && currentCount >= maxAllowed) {
      throw new Error(`Maximum scheduled notes limit (${maxAllowed}) reached`);
    }

    // Validate scheduled time (must be in future)
    if (input.scheduledAt <= new Date()) {
      throw new Error("Scheduled time must be in the future");
    }

    // Create scheduled note
    return this.scheduledNoteRepository.create({
      id: generateId(),
      userId,
      ...input,
      status: "pending",
    });
  }

  async cancel(id: string, userId: string): Promise<void> {
    const note = await this.scheduledNoteRepository.findById(id);
    if (!note || note.userId !== userId) throw new Error("Not found");
    if (note.status !== "pending") throw new Error("Cannot cancel non-pending note");

    await this.scheduledNoteRepository.update(id, { status: "cancelled" });
  }
}
```

#### 3.5 Background Job: ScheduledNotePublisher

```typescript
export class ScheduledNotePublisher {
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    // Check for due notes every minute
    this.intervalId = setInterval(() => this.processQueue(), 60 * 1000);
    // Initial run
    this.processQueue();
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async processQueue(): Promise<void> {
    const now = new Date();
    const dueNotes = await this.scheduledNoteRepository.findPendingToPublish(now, 50);

    for (const scheduled of dueNotes) {
      try {
        const note = await this.noteService.create({
          userId: scheduled.userId,
          text: scheduled.text,
          cw: scheduled.cw,
          visibility: scheduled.visibility,
          localOnly: scheduled.localOnly,
          replyId: scheduled.replyId,
          renoteId: scheduled.renoteId,
          fileIds: scheduled.fileIds,
        });

        await this.scheduledNoteRepository.update(scheduled.id, {
          status: "published",
          publishedNoteId: note.id,
        });
      } catch (error) {
        await this.scheduledNoteRepository.update(scheduled.id, {
          status: "failed",
          errorMessage: error.message,
        });
      }
    }
  }
}
```

#### 3.6 API Endpoints

- `POST /api/notes/schedule` - Create scheduled note
- `GET /api/notes/scheduled` - List user's scheduled notes
- `GET /api/notes/scheduled/:id` - Get scheduled note details
- `PATCH /api/notes/scheduled/:id` - Update scheduled note (content or time)
- `DELETE /api/notes/scheduled/:id` - Cancel/delete scheduled note

#### 3.7 Frontend Changes

- Add "Schedule" option in note composer
- Add "Scheduled" tab in notes/timeline view
- Add scheduled note management UI (list, edit, cancel)
- Show countdown or scheduled time on scheduled notes

---

## Implementation Order

### Phase 1: Storage Quota Enhancement (Foundation)
1. Add `storageQuotaMb` column to users table
2. Add `canManageStorageQuotas` to RolePolicies
3. Update RoleService with `getStorageQuota` method
4. Add quota check to FileService.upload
5. Add API endpoints for quota management
6. Update frontend with storage usage display

### Phase 2: User Storage Management
1. Add `source` column to driveFiles table
2. Add `canViewSystemAcquiredFiles` to RolePolicies
3. Add moderator file management endpoints
4. Update frontend with moderator file management UI

### Phase 3: Scheduled Posts
1. Create scheduledNotes table
2. Add `maxScheduledNotes` to RolePolicies
3. Create IScheduledNoteRepository and PostgresScheduledNoteRepository
4. Create ScheduledNoteService
5. Create ScheduledNotePublisher background service
6. Add API endpoints
7. Update frontend note composer and management

---

## Database Migrations Required

```sql
-- Migration: Add storage management fields
ALTER TABLE users ADD COLUMN storage_quota_mb INTEGER;
ALTER TABLE drive_files ADD COLUMN source TEXT NOT NULL DEFAULT 'user';

-- Migration: Add scheduled notes table
CREATE TABLE scheduled_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  cw TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  local_only BOOLEAN NOT NULL DEFAULT FALSE,
  reply_id TEXT,
  renote_id TEXT,
  file_ids JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  published_note_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX scheduled_note_user_id_idx ON scheduled_notes(user_id);
CREATE INDEX scheduled_note_scheduled_at_idx ON scheduled_notes(scheduled_at);
CREATE INDEX scheduled_note_status_idx ON scheduled_notes(status);
CREATE INDEX scheduled_note_pending_schedule_idx ON scheduled_notes(status, scheduled_at);
```

---

## Estimated Work

- Phase 1 (Storage Quota): 4-6 hours
- Phase 2 (Storage Management): 2-3 hours
- Phase 3 (Scheduled Posts): 6-8 hours

Total: ~14-17 hours of implementation work
