# Plugin Architecture Design for Rox

## Overview

This document outlines a comprehensive plugin architecture for Rox that allows third-party developers to extend functionality without modifying core code.

## Design Goals

1. **Non-invasive**: Plugins should not require modifications to core source code
2. **Type-safe**: Full TypeScript support for plugin development
3. **Sandboxed**: Plugins cannot break core functionality
4. **Hot-reloadable**: Plugins can be enabled/disabled without server restart (where possible)
5. **Discoverable**: Clear API surface for plugin developers

## Current Architecture Analysis

### Existing Extension Points

The codebase already has some implicit extension points:

1. **InboxService Handler Registration** (`services/ap/inbox/InboxService.ts`)
   - `registerHandler(type: string, handler: ActivityHandler)` - Already supports dynamic handler registration
   - Can be extended to allow plugins to add custom ActivityPub activity handlers

2. **Repository Pattern** (`di/container.ts`)
   - All data access through interfaces (IUserRepository, INoteRepository, etc.)
   - Plugins could provide custom repository decorators

3. **Middleware Chain** (`index.ts`)
   - Hono middleware pipeline is explicit
   - Could be modified to accept plugin middleware

4. **Service Layer** (`services/`)
   - Business logic isolated in services
   - Services are injected via DI container

### Current Limitations

1. **No plugin loader**: No mechanism to discover and load plugins
2. **No lifecycle hooks**: No events emitted for note creation, user registration, etc.
3. **Hardcoded routes**: Routes are statically imported in index.ts
4. **No frontend plugin API**: No way for plugins to add UI components

---

## Proposed Plugin Architecture

### Phase 1: Backend Hook System (Foundation)

#### 1.1 Event Emitter System

Create a central event bus for lifecycle events:

```typescript
// packages/backend/src/lib/events.ts
export type RoxEvent =
  // Note lifecycle
  | { type: 'note:beforeCreate'; data: { input: NoteCreateInput; user: User } }
  | { type: 'note:afterCreate'; data: { note: Note; user: User } }
  | { type: 'note:beforeDelete'; data: { noteId: string; userId: string } }
  | { type: 'note:afterDelete'; data: { noteId: string; userId: string } }
  // User lifecycle
  | { type: 'user:beforeRegister'; data: { input: UserCreateInput } }
  | { type: 'user:afterRegister'; data: { user: User } }
  | { type: 'user:beforeLogin'; data: { username: string } }
  | { type: 'user:afterLogin'; data: { user: User; session: Session } }
  // Follow lifecycle
  | { type: 'follow:afterCreate'; data: { follower: User; followee: User } }
  | { type: 'follow:afterDelete'; data: { followerId: string; followeeId: string } }
  // ActivityPub
  | { type: 'ap:beforeInbox'; data: { activity: Activity; actor: Actor } }
  | { type: 'ap:afterInbox'; data: { activity: Activity; actor: Actor; result: unknown } }
  | { type: 'ap:beforeDelivery'; data: { activity: Activity; targets: string[] } }
  // Moderation
  | { type: 'mod:userSuspended'; data: { userId: string; reason: string } }
  | { type: 'mod:noteDeleted'; data: { noteId: string; reason: string } };

export interface EventBus {
  emit<T extends RoxEvent['type']>(
    type: T,
    data: Extract<RoxEvent, { type: T }>['data']
  ): Promise<void>;
  
  on<T extends RoxEvent['type']>(
    type: T,
    handler: (data: Extract<RoxEvent, { type: T }>['data']) => Promise<void> | void
  ): () => void; // returns unsubscribe function
  
  // For "before" events that can modify or cancel
  onBefore<T extends RoxEvent['type']>(
    type: T,
    handler: (data: Extract<RoxEvent, { type: T }>['data']) => Promise<{ cancel?: boolean; modified?: unknown }> | void
  ): () => void;
}
```

#### 1.2 Plugin Interface Definition

```typescript
// packages/backend/src/plugins/types.ts
export interface RoxPlugin {
  /** Unique plugin identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** Plugin description */
  description?: string;
  
  /** Minimum Rox version required */
  minRoxVersion?: string;
  
  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];
  
  /** Called when plugin is loaded */
  onLoad?(context: PluginContext): Promise<void> | void;
  
  /** Called when plugin is unloaded */
  onUnload?(): Promise<void> | void;
  
  /** Register API routes */
  routes?: (app: Hono) => void;
  
  /** Register middleware */
  middleware?: MiddlewareHandler[];
  
  /** Register ActivityPub handlers */
  activityHandlers?: Record<string, ActivityHandler>;
  
  /** Admin UI metadata (for plugin management) */
  adminUI?: {
    settingsComponent?: string; // Path to settings component
    configSchema?: z.ZodSchema; // Configuration schema
  };
}

export interface PluginContext {
  /** Event bus for subscribing to events */
  events: EventBus;
  
  /** Access to repositories (read-only or limited write) */
  repositories: PluginRepositories;
  
  /** Logger namespaced to plugin */
  logger: Logger;
  
  /** Plugin configuration storage */
  config: PluginConfigStorage;
  
  /** Register a scheduled task */
  registerScheduledTask(task: ScheduledTask): void;
  
  /** Base URL of the instance */
  baseUrl: string;
}
```

#### 1.3 Plugin Loader

```typescript
// packages/backend/src/plugins/loader.ts
export class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  
  /** Load plugins from directory */
  async loadFromDirectory(dir: string): Promise<void>;
  
  /** Load a single plugin */
  async loadPlugin(pluginPath: string): Promise<void>;
  
  /** Unload a plugin by ID */
  async unloadPlugin(id: string): Promise<void>;
  
  /** Get all loaded plugins */
  getPlugins(): RoxPlugin[];
  
  /** Enable/disable plugin (persisted) */
  async setEnabled(id: string, enabled: boolean): Promise<void>;
}
```

### Phase 2: Integration Points

#### 2.1 Service Layer Hooks

Modify services to emit events:

```typescript
// Example: NoteService.ts modification
class NoteService {
  async create(input: NoteCreateInput, user: User): Promise<Note> {
    // Emit before event (can be cancelled/modified)
    const beforeResult = await this.events.emitBefore('note:beforeCreate', { input, user });
    if (beforeResult.cancel) {
      throw new Error('Note creation cancelled by plugin');
    }
    const finalInput = beforeResult.modified ?? input;
    
    // ... existing creation logic ...
    
    // Emit after event
    await this.events.emit('note:afterCreate', { note, user });
    
    return note;
  }
}
```

#### 2.2 Custom API Routes

Plugins can register routes under `/api/x/{pluginId}/`:

```typescript
// Example plugin with custom routes
const myPlugin: RoxPlugin = {
  id: 'my-plugin',
  routes(app) {
    app.get('/api/x/my-plugin/stats', async (c) => {
      return c.json({ /* ... */ });
    });
  }
};
```

#### 2.3 Custom ActivityPub Activities

```typescript
const customActivityPlugin: RoxPlugin = {
  id: 'custom-activity',
  activityHandlers: {
    'CustomType': async (activity, actor, context) => {
      // Handle custom activity
    }
  }
};
```

### Phase 3: Frontend Plugin System

#### 3.1 Plugin Slot System

Define slots where plugins can inject components:

```typescript
// packages/frontend/src/lib/plugins/slots.ts
export const PLUGIN_SLOTS = {
  // Note display
  'note:header': 'Before note header',
  'note:footer': 'After note content',
  'note:actions': 'Additional note action buttons',
  
  // Compose
  'compose:toolbar': 'Additional compose toolbar items',
  'compose:footer': 'Below compose textarea',
  
  // User profile
  'profile:header': 'Additional profile header content',
  'profile:tabs': 'Additional profile tabs',
  
  // Settings
  'settings:tabs': 'Additional settings tabs',
  
  // Admin
  'admin:sidebar': 'Additional admin sidebar items',
  'admin:dashboard': 'Additional dashboard widgets',
  
  // Navigation
  'sidebar:bottom': 'Before sidebar footer',
} as const;
```

#### 3.2 Frontend Plugin API

```typescript
// packages/frontend/src/lib/plugins/types.ts
export interface FrontendPlugin {
  id: string;
  
  /** Components to inject into slots */
  slots?: {
    [K in keyof typeof PLUGIN_SLOTS]?: React.ComponentType<SlotProps[K]>;
  };
  
  /** Custom pages/routes */
  pages?: {
    path: string;
    component: React.ComponentType;
  }[];
  
  /** Jotai atoms for plugin state */
  atoms?: Record<string, Atom<unknown>>;
  
  /** i18n messages */
  messages?: Record<string, Record<string, string>>;
}
```

### Phase 4: Plugin Distribution

#### 4.1 Plugin Package Format

```
my-plugin/
├── plugin.json           # Plugin metadata & manifest
├── backend/
│   └── index.ts          # Backend plugin entry
├── frontend/
│   └── index.tsx         # Frontend plugin entry
└── README.md
```

#### 4.2 Plugin Registry

**Important**: The plugin registry will be hosted on the official Rox website (separate project).

**Requirements for Official Site**:
- Plugin listing page with search/filter
- Plugin detail pages (description, screenshots, reviews)
- Version management and compatibility matrix
- Plugin submission workflow
- Security review process
- Download/installation instructions

**Distribution Method**:
- NOT npm-based (npm is not realistic for this use case)
- Git repository URLs (GitHub/GitLab)
- Direct download as zip/tarball from registry
- `rox plugin install <plugin-name>` CLI command

**Plugin Manifest (plugin.json)**:
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Author Name",
  "repository": "https://github.com/author/my-plugin",
  "minRoxVersion": "2025.12.0",
  "permissions": ["note:read", "note:write", "user:read"],
  "backend": "backend/index.ts",
  "frontend": "frontend/index.tsx",
  "configSchema": { /* JSON Schema for settings */ }
}
```

**Documentation Needed for Plugin Developers**:
1. Getting Started Guide
   - Setting up development environment
   - Plugin structure and manifest format
   - Hello World example

2. Backend Plugin API
   - Event hooks and lifecycle
   - Available services and repositories
   - Custom routes registration
   - ActivityPub handler registration

3. Frontend Plugin API
   - Slot system and available slots
   - React component requirements
   - State management with Jotai
   - i18n integration

4. Best Practices
   - Security guidelines
   - Performance considerations
   - Testing plugins
   - Versioning and compatibility

5. Publishing Guide
   - Submission process to official registry
   - Review criteria
   - Update/maintenance workflow

---

## Implementation Priority

### High Priority (Core Infrastructure)
1. Event bus system
2. Plugin interface & types
3. Plugin loader
4. NoteService/UserService hook integration

### Medium Priority (Extensibility)
5. Custom route registration
6. ActivityPub handler registration
7. Plugin configuration storage
8. Admin plugin management UI

### Lower Priority (Polish)
9. Frontend slot system
10. Plugin marketplace
11. Hot reloading
12. Plugin sandboxing

---

## Example Plugins

### Example 1: Auto-CW Plugin
Automatically adds content warnings based on keywords:

```typescript
const autoCWPlugin: RoxPlugin = {
  id: 'auto-cw',
  name: 'Auto Content Warning',
  version: '1.0.0',
  
  onLoad({ events, config }) {
    events.onBefore('note:beforeCreate', async ({ input }) => {
      const keywords = await config.get<string[]>('keywords') ?? [];
      const hasSensitiveContent = keywords.some(kw => 
        input.text?.toLowerCase().includes(kw.toLowerCase())
      );
      
      if (hasSensitiveContent && !input.cw) {
        return {
          modified: { ...input, cw: 'Auto-CW: May contain sensitive content' }
        };
      }
    });
  }
};
```

### Example 2: Custom Emoji Reactions Plugin
Adds support for custom reaction types beyond standard emoji:

```typescript
const customReactionsPlugin: RoxPlugin = {
  id: 'custom-reactions',
  name: 'Custom Reactions',
  version: '1.0.0',
  
  routes(app) {
    app.post('/api/x/custom-reactions/:noteId', async (c) => {
      // Custom reaction logic
    });
  },
  
  activityHandlers: {
    'CustomReaction': async (activity, actor, context) => {
      // Handle federated custom reactions
    }
  }
};
```

### Example 3: Analytics Plugin
Tracks note views and engagement:

```typescript
const analyticsPlugin: RoxPlugin = {
  id: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  
  onLoad({ events, repositories, logger }) {
    events.on('note:afterCreate', async ({ note, user }) => {
      logger.info({ noteId: note.id }, 'Note created');
      // Store analytics data
    });
  },
  
  routes(app) {
    app.get('/api/x/analytics/stats', async (c) => {
      // Return analytics data
    });
  }
};
```

---

## Security Considerations

1. **Sandboxing**: Plugins run in the same process but with limited API access
2. **Permission System**: Plugins declare required permissions in manifest
3. **Code Review**: Official plugins go through review process
4. **Rate Limiting**: Plugin API calls are rate-limited
5. **Audit Logging**: Plugin actions are logged for security

---

## Migration Path

1. **Phase 1**: Implement event bus, integrate with core services
2. **Phase 2**: Add plugin loader, enable first-party plugins
3. **Phase 3**: Document API, release plugin SDK
4. **Phase 4**: Frontend plugin support
5. **Phase 5**: Plugin marketplace

---

## Related Files to Modify

### Backend
- `packages/backend/src/index.ts` - Plugin initialization
- `packages/backend/src/di/container.ts` - Add EventBus
- `packages/backend/src/services/NoteService.ts` - Add event emissions
- `packages/backend/src/services/UserService.ts` - Add event emissions
- `packages/backend/src/services/ap/inbox/InboxService.ts` - Already extensible

### Frontend
- `packages/frontend/src/App.tsx` - Plugin slot rendering
- New: `packages/frontend/src/lib/plugins/` - Plugin infrastructure

### New Files
- `packages/backend/src/plugins/` - Plugin system
- `packages/backend/src/lib/events.ts` - Event bus
- `packages/shared/src/types/plugin.ts` - Shared plugin types

---

## Implementation Status

### Phase 1: EventBus Foundation ✅ COMPLETED (2025-12-19)

**Branch**: `feature/plugin-eventbus-foundation`
**Commit**: `a72bfff`

**Implemented Files**:
- `packages/backend/src/plugins/types/events.ts` - Event type definitions
- `packages/backend/src/plugins/EventBus.ts` - EventBus implementation
- `packages/backend/src/plugins/index.ts` - Plugin exports
- `packages/backend/src/interfaces/IEventBus.ts` - IEventBus interface
- `packages/backend/src/tests/unit/EventBus.test.ts` - Unit tests (all passing)

**Integrated Services**:
- `NoteService` - beforeCreate/afterCreate/beforeDelete/afterDelete
- `AuthService` - beforeRegister/afterRegister
- `DIコンテナ` - EventBus instance available via container

**Event Types**:
```typescript
type RoxEvent =
  | NoteBeforeCreateEvent   // Cancellable, modifiable
  | NoteAfterCreateEvent    // Notification only
  | NoteBeforeDeleteEvent   // Cancellable
  | NoteAfterDeleteEvent    // Notification only
  | UserBeforeRegisterEvent // Cancellable, modifiable
  | UserAfterRegisterEvent  // Notification only
```

**API**:
- `eventBus.on(type, handler)` - Subscribe to after events
- `eventBus.onBefore(type, handler)` - Subscribe to before events
- `eventBus.emit(type, data)` - Emit after events (parallel)
- `eventBus.emitBefore(type, data)` - Emit before events (sequential, cancellable)

---

### Phase 2: Plugin Loader & Integration ✅ COMPLETED (2025-12-19)

**Branch**: `feature/plugin-eventbus-foundation`

**Implemented Files**:
- `packages/backend/src/plugins/types/plugin.ts` - RoxPlugin, PluginContext, PluginManifest interfaces
- `packages/backend/src/plugins/PluginLoader.ts` - Plugin discovery, loading, and lifecycle management
- `packages/backend/src/plugins/PluginConfigStorage.ts` - File-based and in-memory config storage
- `packages/backend/src/tests/unit/PluginLoader.test.ts` - Unit tests (all passing)

**Updated Files**:
- `packages/backend/src/plugins/index.ts` - Export PluginLoader and config storage
- `packages/backend/src/index.ts` - Integrated PluginLoader into app startup and shutdown

**Key Features**:
- **RoxPlugin Interface**: Complete plugin definition with id, name, version, lifecycle hooks
- **PluginContext**: Provides plugins with events, logger, config storage, scheduled tasks
- **PluginLoader**: Loads plugins from directory, validates dependencies, version compatibility
- **Plugin Routes**: Plugins can register routes under `/api/x/{pluginId}/`
- **Scheduled Tasks**: Plugins can register recurring tasks with cron-like or ms intervals
- **Graceful Shutdown**: Plugins are properly unloaded during server shutdown

**Environment Variable**:
- `PLUGIN_DIRECTORY`: Directory to load plugins from (default: `./plugins`)

**Example Plugin**:
```typescript
const myPlugin: RoxPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',

  onLoad({ events, logger, config }) {
    events.on('note:afterCreate', ({ note }) => {
      logger.info({ noteId: note.id }, 'Note created');
    });
  },

  routes(app) {
    app.get('/status', (c) => c.json({ status: 'ok' }));
  }
};

export default myPlugin;
```

---

### Phase 3: Frontend Plugin System ✅ COMPLETED (2025-12-19)

**Branch**: `feature/plugin-eventbus-foundation`
**Commit**: `6ae6131`

**Implemented Files**:
- `packages/frontend/src/lib/plugins/slots.ts` - PLUGIN_SLOTS constant with 12 slot definitions
- `packages/frontend/src/lib/plugins/types.ts` - FrontendPlugin, SlotProps, and related types
- `packages/frontend/src/lib/plugins/registry.ts` - FrontendPluginRegistry class and hooks
- `packages/frontend/src/lib/plugins/PluginSlot.tsx` - React component for slot rendering
- `packages/frontend/src/lib/plugins/index.ts` - Public exports
- `packages/frontend/src/tests/plugins/registry.test.ts` - Unit tests (13 tests passing)

**Updated Files**:
- `packages/frontend/src/components/note/NoteCard.tsx` - Integrated 3 plugin slots

**Available Slots**:
| Slot Name | Location |
|-----------|----------|
| `note:header` | Before note header content |
| `note:footer` | After note content, before reactions |
| `note:actions` | Additional note action buttons |
| `compose:toolbar` | Additional compose toolbar items |
| `compose:footer` | Below compose textarea |
| `profile:header` | Additional profile header content |
| `profile:tabs` | Additional profile tabs |
| `settings:tabs` | Additional settings tabs |
| `admin:sidebar` | Additional admin sidebar items |
| `admin:dashboard` | Additional dashboard widgets |
| `sidebar:bottom` | Before sidebar footer |

**Slot Props Types**:
- `NoteSlotProps`: noteId, userId, visibility
- `ComposeSlotProps`: text, insertText callback, replyToId
- `ProfileSlotProps`: userId, username, isOwnProfile
- `SettingsSlotProps`: userId
- `AdminSlotProps`: isAdmin
- `SidebarSlotProps`: isCollapsed

**Key Features**:
- **FrontendPlugin Interface**: slots, pages, atoms, messages, lifecycle hooks
- **PluginSlot Component**: Renders plugin components at designated slots
- **Jotai Integration**: Reactive state via pluginListAtom, enabledPluginsAtom
- **Registry Hooks**: usePlugins, useEnabledPlugins, usePluginSlotComponents, usePluginRegistry
- **Error Handling**: Plugin errors don't break host components

---

### Phase 4: Plugin Distribution System ✅ COMPLETED (2025-12-19)

**Branch**: `feature/plugin-eventbus-foundation`
**Commit**: `2a17484`

**Implemented Files**:
- `packages/backend/src/plugins/PluginManager.ts` - Full plugin lifecycle management
- `packages/backend/src/plugins/ManifestValidator.ts` - Manifest validation with detailed errors
- `packages/backend/src/plugins/cli.ts` - CLI commands for plugin operations
- `packages/shared/src/types/plugin.ts` - Shared plugin types (PluginManifest, PluginListEntry, etc.)
- `plugins/README.md` - Plugin development documentation

**Sample Plugins**:
- `plugins/activity-logger/` - Backend plugin for activity logging
- `plugins/auto-cw/` - Backend + Frontend plugin for automatic content warnings

**CLI Commands** (via `bun run plugin <command>`):
| Command | Description |
|---------|-------------|
| `install <source>` | Install from Git URL or local path |
| `uninstall <id>` | Remove a plugin |
| `list` | List all installed plugins |
| `enable <id>` | Enable a disabled plugin |
| `disable <id>` | Disable an enabled plugin |
| `info <id>` | Show plugin details |

**Key Features**:
- **Git Installation**: Clone from GitHub/GitLab URLs
- **Local Installation**: Copy from local directory
- **Manifest Validation**: Schema validation with helpful error messages
- **Permission Declaration**: Plugins declare required permissions
- **Version Compatibility**: minRoxVersion/maxRoxVersion support

---

### Phase 5: Admin Plugin Management API ✅ COMPLETED (2025-12-19)

**Branch**: `feature/plugin-eventbus-foundation`
**Commit**: `c6685b4`

**Implemented Files**:
- `packages/backend/src/routes/admin-plugins.ts` - REST API endpoints for plugin management
- `packages/backend/src/tests/unit/AdminPluginsRoute.test.ts` - Unit tests (16 tests passing)
- `docs/plugins/README.md` - Plugin system documentation
- `docs/plugins/marketplace-specification.md` - Marketplace API specification

**API Endpoints** (under `/api/admin/plugins`):
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all plugins |
| GET | `/:id` | Get plugin details |
| POST | `/:id/enable` | Enable a plugin |
| POST | `/:id/disable` | Disable a plugin |
| POST | `/install` | Install from source |
| DELETE | `/:id` | Uninstall a plugin |
| GET | `/:id/config` | Get plugin configuration |
| PUT | `/:id/config` | Update plugin configuration |

**Marketplace Specification**:
- Separate service architecture (not part of Rox core)
- REST API for search, download, publish
- Publisher verification and trust levels
- Plugin categories and security scanning
- Implementation roadmap (Phase 1-4)

---

## Next Steps

### Phase 6: Admin Plugin UI (Frontend) ✅ COMPLETED (2025-12-19)

**Branch**: `feature/plugin-eventbus-foundation`
**Commit**: `6a31438`

**Implemented Files**:
- `packages/frontend/src/lib/api/plugins.ts` - Plugin API client
- `packages/frontend/src/components/admin/plugins/PluginCard.tsx` - Plugin display card
- `packages/frontend/src/components/admin/plugins/PluginInstallDialog.tsx` - Install dialog
- `packages/frontend/src/components/admin/plugins/PluginConfigDialog.tsx` - Config editor dialog
- `packages/frontend/src/components/admin/plugins/PluginsPage.tsx` - Main management page
- `packages/frontend/src/components/admin/plugins/index.ts` - Component exports

**Updated Files**:
- `packages/frontend/src/lib/api/client.ts` - Added PUT method
- `packages/frontend/src/components/admin/AdminLayout.tsx` - Added Plugins navigation

**Features**:
- View list of installed plugins
- Enable/disable plugins
- Install plugins from Git URL or local path
- Uninstall plugins
- View and edit plugin configuration (JSON)
- Responsive design with loading/error states
- React Aria accessible components

### Phase 7: Plugin Sandboxing & Security

**Goal**: Enhance plugin security isolation

### Phase 8: Hot Reloading

**Goal**: Enable plugin updates without server restart

---

## Notes

- Recorded: 2025-12-10
- Updated: 2025-12-19 (Phases 1-5 completed)
- Status: Phases 1-5 complete, Phase 6 (Admin Plugin UI) in progress
- PR #99 created for merging to main
- This design prioritizes gradual implementation without breaking changes
- This design prioritizes gradual implementation without breaking changes
