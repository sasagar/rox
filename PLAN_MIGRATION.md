# Implementation Plan: ActivityPub Account Migration (Move Activity)

> **Status: Planning** (November 2025)

## Overview

This plan implements full ActivityPub account migration support, enabling:
1. **Transfer Out**: Move from Rox to another server (Mastodon, Misskey, etc.)
2. **Transfer In**: Move from another server to Rox
3. **Receive Move**: Auto-follow new accounts when followed users migrate

## ActivityPub Move Specification

### Move Activity Format
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Move",
  "actor": "https://old-server.example/users/alice",
  "object": "https://old-server.example/users/alice",
  "target": "https://new-server.example/users/alice",
  "to": "https://old-server.example/users/alice/followers"
}
```

### Required Actor Properties

#### `alsoKnownAs` (Array)
- Lists alternative account URIs for the same person
- **Must be set on BOTH accounts** for migration validation
- Used for bi-directional verification

#### `movedTo` (String)
- Set on the OLD account after migration
- Points to the new account URI
- Signals that this account has permanently moved

### Security Requirements
1. **Bi-directional validation**: Old account must have new account in `alsoKnownAs`, and vice versa
2. **30-day cooldown**: Prevent rapid account switching (spam prevention)
3. **One active migration**: Cannot migrate while another migration is pending

---

## Phase 1: Database Schema Changes

### 1.1 User Table Updates

Add new columns to `users` table:

```sql
ALTER TABLE users ADD COLUMN also_known_as TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN moved_to TEXT;
ALTER TABLE users ADD COLUMN moved_at TIMESTAMP;
```

**Schema Changes in `packages/backend/src/db/schema/pg.ts`:**

```typescript
// Add to users table definition
alsoKnownAs: text('also_known_as').array().default([]),  // Array of alternative account URIs
movedTo: text('moved_to'),                               // URI of account this user moved to
movedAt: timestamp('moved_at'),                          // When migration was completed
```

### 1.2 Migration Cooldown Table (Optional)

For tracking migration cooldown (30 days):

```sql
CREATE TABLE account_migrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_uri TEXT NOT NULL,
  to_uri TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

## Phase 2: Backend Implementation

### 2.1 New Files

| File | Purpose |
|------|---------|
| `src/services/ap/inbox/handlers/MoveHandler.ts` | Handle incoming Move activities |
| `src/services/MigrationService.ts` | Account migration business logic |
| `src/routes/migration.ts` | API endpoints for migration management |
| `src/interfaces/repositories/IMigrationRepository.ts` | Migration data interface (optional) |

### 2.2 MigrationService

```typescript
interface MigrationService {
  // Alias management
  addAlias(userId: string, aliasUri: string): Promise<void>;
  removeAlias(userId: string, aliasUri: string): Promise<void>;
  getAliases(userId: string): Promise<string[]>;

  // Transfer out (move FROM Rox to another server)
  validateTransferOut(userId: string, targetUri: string): Promise<ValidationResult>;
  initiateTransferOut(userId: string, targetUri: string): Promise<void>;

  // Transfer in (move TO Rox from another server)
  validateTransferIn(userId: string, sourceUri: string): Promise<ValidationResult>;

  // Cooldown check
  canMigrate(userId: string): Promise<{ allowed: boolean; reason?: string }>;
}
```

### 2.3 MoveHandler

Handle incoming Move activities from followed users:

```typescript
export class MoveHandler extends BaseHandler {
  readonly activityType = 'Move';

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    // 1. Extract actor (old account) and target (new account)
    // 2. Validate bi-directional alsoKnownAs
    // 3. For each local follower of old account:
    //    a. Check if already following new account
    //    b. If not, create follow to new account
    //    c. Send Follow activity to new account
    //    d. Optionally unfollow old account
    // 4. Update cached remote user data (set movedTo)
  }
}
```

### 2.4 Actor Document Updates

Modify `packages/backend/src/routes/ap/actor.ts`:

```typescript
const actorDocument = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
  ],
  id: `${baseUrl}/users/${user.username}`,
  type: 'Person',
  // ... existing fields ...

  // Add migration-related fields
  alsoKnownAs: user.alsoKnownAs?.length ? user.alsoKnownAs : undefined,
  movedTo: user.movedTo || undefined,
};
```

### 2.5 InboxService Registration

Add MoveHandler to `InboxService.ts`:

```typescript
import { MoveHandler } from './handlers/MoveHandler.js';

private registerDefaultHandlers(): void {
  // ... existing handlers ...
  this.registerHandler(new MoveHandler());
}
```

---

## Phase 3: API Endpoints

### 3.1 Alias Management

```
GET    /api/i/aliases           - List own account aliases
POST   /api/i/aliases           - Add new alias
DELETE /api/i/aliases/:uri      - Remove alias
```

### 3.2 Migration Control

```
POST   /api/i/migration/validate     - Validate migration target
POST   /api/i/migration/initiate     - Start migration (send Move to followers)
GET    /api/i/migration/status       - Check migration status
```

### 3.3 Request/Response Examples

**Add Alias:**
```json
POST /api/i/aliases
{
  "uri": "https://mastodon.social/users/alice"
}
```

**Validate Migration:**
```json
POST /api/i/migration/validate
{
  "targetUri": "https://mastodon.social/users/alice"
}

Response:
{
  "valid": true,
  "targetAccount": {
    "uri": "https://mastodon.social/users/alice",
    "username": "alice",
    "host": "mastodon.social",
    "hasReverseAlias": true
  }
}
```

**Initiate Migration:**
```json
POST /api/i/migration/initiate
{
  "targetUri": "https://mastodon.social/users/alice"
}

Response:
{
  "success": true,
  "movedTo": "https://mastodon.social/users/alice",
  "followersNotified": 42
}
```

---

## Phase 4: Move Activity Delivery

When a user initiates transfer out:

1. Set `movedTo` on local account
2. Send Move activity to all followers:

```typescript
async function sendMoveToFollowers(user: User, targetUri: string) {
  const followers = await followRepository.findFollowersOf(user.id);

  const moveActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Move',
    actor: `${baseUrl}/users/${user.username}`,
    object: `${baseUrl}/users/${user.username}`,
    target: targetUri,
    to: [`${baseUrl}/users/${user.username}/followers`],
  };

  // Use shared inbox where available for efficiency
  const inboxes = getUniqueInboxes(followers);

  for (const inbox of inboxes) {
    await activityDeliveryQueue.enqueue({
      activity: moveActivity,
      targetInbox: inbox,
      actorId: user.id,
    });
  }
}
```

---

## Phase 5: Frontend UI

### 5.1 Settings Page Section

New section in `/settings/account`:

```
Account Migration
├── Manage Aliases
│   ├── List current aliases (alsoKnownAs)
│   ├── Add new alias input + verify button
│   └── Remove alias buttons
│
└── Move Account
    ├── Transfer Out Section
    │   ├── Target account input
    │   ├── Validate button (checks bi-directional alias)
    │   ├── Initiate Migration button (with confirmation dialog)
    │   └── Warning about irreversibility
    │
    └── Migration Status
        ├── Current movedTo (if set)
        └── Last migration date
```

### 5.2 Components

| Component | Purpose |
|-----------|---------|
| `AliasManager.tsx` | CRUD for account aliases |
| `MigrationDialog.tsx` | Confirmation dialog for migration |
| `MigrationStatus.tsx` | Shows current migration state |

### 5.3 Profile Display

When viewing a user who has migrated:

```tsx
{user.movedTo && (
  <MovedBanner>
    This account has moved to:
    <a href={user.movedTo}>{formatAcct(user.movedTo)}</a>
  </MovedBanner>
)}
```

---

## Phase 6: Validation Logic

### 6.1 Transfer Out Validation

```typescript
async function validateTransferOut(userId: string, targetUri: string) {
  // 1. Check cooldown period
  const lastMigration = await getMigrationHistory(userId);
  if (lastMigration && daysSince(lastMigration) < 30) {
    return { valid: false, error: 'COOLDOWN_ACTIVE' };
  }

  // 2. Fetch target actor
  const targetActor = await remoteActorService.resolveActor(targetUri);
  if (!targetActor) {
    return { valid: false, error: 'TARGET_NOT_FOUND' };
  }

  // 3. Check target has our account in alsoKnownAs
  const localUri = `${baseUrl}/users/${user.username}`;
  if (!targetActor.alsoKnownAs?.includes(localUri)) {
    return { valid: false, error: 'REVERSE_ALIAS_MISSING' };
  }

  // 4. Check we have target in our alsoKnownAs
  if (!user.alsoKnownAs?.includes(targetUri)) {
    return { valid: false, error: 'ALIAS_MISSING' };
  }

  return { valid: true, targetActor };
}
```

### 6.2 Move Activity Validation (Incoming)

```typescript
async function validateMoveActivity(activity: MoveActivity) {
  const oldAccountUri = activity.actor;
  const newAccountUri = activity.target;

  // 1. Verify the activity is signed by the old account
  // (Already done by HTTP Signature verification)

  // 2. Fetch both accounts
  const oldAccount = await remoteActorService.resolveActor(oldAccountUri);
  const newAccount = await remoteActorService.resolveActor(newAccountUri);

  // 3. Verify bi-directional alsoKnownAs
  const oldHasNew = oldAccount.alsoKnownAs?.includes(newAccountUri);
  const newHasOld = newAccount.alsoKnownAs?.includes(oldAccountUri);

  if (!oldHasNew || !newHasOld) {
    return { valid: false, error: 'BIDIRECTIONAL_CHECK_FAILED' };
  }

  return { valid: true };
}
```

---

## Phase 7: Testing Strategy

### 7.1 Unit Tests

| Test File | Coverage |
|-----------|----------|
| `MigrationService.test.ts` | Alias CRUD, validation logic, cooldown |
| `MoveHandler.test.ts` | Incoming Move activity processing |
| `migration.route.test.ts` | API endpoint validation |

### 7.2 Integration Tests

1. **Transfer Out Flow**
   - Add alias → Validate → Initiate → Verify Move sent

2. **Move Reception Flow**
   - Receive Move → Validate → Auto-follow new account

3. **Mastodon Interoperability**
   - Test with real Mastodon instance in dev environment

---

## Implementation Order

1. **Database schema migration** (add columns to users table)
2. **Update User type definitions** and repository
3. **Actor document generation** (add alsoKnownAs, movedTo)
4. **MigrationService** implementation
5. **API endpoints** for alias management
6. **MoveHandler** for incoming Move activities
7. **Transfer out logic** (send Move to followers)
8. **Frontend UI** for alias management
9. **Frontend UI** for migration initiation
10. **Unit tests**
11. **Integration tests with Mastodon**

---

## Estimated Changes

- New files: ~8
- Modified files: ~6
- New tests: ~30
- Database migration: 1

---

## Backward Compatibility

- Users without migration fields will have empty `alsoKnownAs` and null `movedTo`
- Actor documents will omit undefined fields (no breaking change)
- Existing follows and activities unaffected

---

## Security Considerations

1. **Rate limiting** on alias add/remove operations
2. **Cooldown enforcement** cannot be bypassed
3. **Activity signature verification** must pass before processing Move
4. **Remote actor fetch** uses timeouts and size limits
5. **No self-referential aliases** (cannot add own account as alias)

---

## Mastodon Compatibility Notes

Based on Mastodon's implementation:

1. Mastodon uses `toot:movedTo` in context (we should accept both)
2. Mastodon may include `published` timestamp in Move activity
3. Mastodon followers automatically re-follow within 24 hours
4. Mastodon shows migration notice on profile indefinitely

---

## Future Enhancements

- [ ] Import followers list from old account (if supported)
- [ ] Export data before migration
- [ ] Notification to followers before migration
- [ ] Admin control over migration permissions (via roles)
