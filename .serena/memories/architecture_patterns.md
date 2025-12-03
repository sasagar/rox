# Rox Architecture Patterns

## Core Design Principles

### 1. Repository Pattern

All database operations are abstracted through repository interfaces:

```
interfaces/repositories/
├── IUserRepository.ts
├── INoteRepository.ts
├── IFollowRepository.ts
├── ISessionRepository.ts
├── IDriveFileRepository.ts
├── IReactionRepository.ts
├── IInstanceBlockRepository.ts
├── IUserReportRepository.ts
├── IRoleRepository.ts
├── IRoleAssignmentRepository.ts
├── IInstanceSettingsRepository.ts
├── ICustomEmojiRepository.ts
├── IModerationAuditLogRepository.ts
├── IUserWarningRepository.ts
├── IInvitationCodeRepository.ts
├── INotificationRepository.ts
├── IReceivedActivityRepository.ts
├── IRemoteInstanceRepository.ts
└── IScheduledNoteRepository.ts
```

Implementations per database type:
- `repositories/pg/` - PostgreSQL implementations

### 2. Adapter Pattern

Infrastructure concerns abstracted via adapters:

```
adapters/
├── storage/
│   ├── LocalStorageAdapter.ts
│   └── S3StorageAdapter.ts
└── cache/
    └── DragonflyCacheAdapter.ts
```

### 3. Dependency Injection

Container-based DI via `di/container.ts`:

```typescript
// AppContainer provides all dependencies
export interface AppContainer {
  userRepository: IUserRepository;
  noteRepository: INoteRepository;
  fileStorage: IFileStorage;
  cacheService: ICacheService;
  // ... other dependencies
}

// Injected via Hono middleware
c.get('userRepository')
c.get('noteRepository')
```

### 4. Service Layer

Business logic isolated in services:

```
services/
├── AuthService.ts          # Authentication
├── UserService.ts          # User management
├── NoteService.ts          # Note/post management
├── FollowService.ts        # Follow relationships
├── ReactionService.ts      # Emoji reactions
├── FileService.ts          # File uploads
├── RoleService.ts          # RBAC
├── InstanceSettingsService.ts
├── MigrationService.ts     # Account migration
├── NotificationService.ts  # Notifications
├── NotificationStreamService.ts  # SSE push
├── ScheduledNoteService.ts # Scheduled posts
├── ScheduledNotePublisher.ts
├── RemoteInstanceService.ts  # Instance info
├── WebPushService.ts       # Web push
└── ap/                     # ActivityPub
    ├── RemoteActorService.ts
    ├── RemoteNoteService.ts
    ├── ActivityPubDeliveryService.ts
    ├── ActivityDeliveryQueue.ts
    └── inbox/
        ├── InboxService.ts
        └── handlers/       # Activity handlers
```

## Backend Directory Structure

```
packages/backend/src/
├── adapters/       # Infrastructure adapters
├── db/             # Database schema & migrations
│   └── schema/     # Drizzle schema definitions
├── di/             # Dependency injection
├── interfaces/     # Abstract interfaces
├── lib/            # Utilities (validation, etc.)
├── middleware/     # Hono middleware
├── repositories/   # Data access layer
├── routes/         # API endpoints
├── services/       # Business logic
├── tests/          # Test files
└── index.ts        # Application entry
```

## Frontend Directory Structure

```
packages/frontend/src/
├── components/     # React components
│   ├── ui/         # Base UI components
│   ├── layout/     # Layout components
│   ├── auth/       # Authentication
│   ├── note/       # Note display/compose
│   ├── timeline/   # Timeline views
│   ├── user/       # User profile
│   ├── settings/   # Settings pages
│   ├── admin/      # Admin dashboard
│   ├── moderator/  # Moderation tools
│   └── mfm/        # MFM rendering
├── hooks/          # Custom hooks
├── lib/            # Utilities
│   ├── api/        # API client
│   └── atoms/      # Jotai atoms
├── locales/        # i18n translations
├── pages/          # Route pages
└── styles/         # Global styles
```

## Key API Routes

### Public API
- `/api/auth/*` - Authentication
- `/api/users/*` - User endpoints
- `/api/notes/*` - Note endpoints
- `/api/following/*` - Follow relationships
- `/api/reactions/*` - Reactions

### Admin API (`/api/admin/*`)
- Instance settings
- Role management
- User administration

### Moderator API (`/api/mod/*`)
- User reports
- Note moderation
- User warnings
- Instance blocking
- Audit logs

### Notifications API (`/api/notifications/*`)
- List notifications
- SSE stream for real-time updates
- Mark as read
- Delete notifications

### Push API (`/api/push/*`)
- Web push subscription management
- VAPID key endpoint

### ActivityPub
- `/.well-known/webfinger`
- `/users/:username` - Actor
- `/users/:username/inbox` - Inbox
- `/users/:username/outbox` - Outbox
- `/notes/:id` - Note activity
