# Rox Plugin Development Guide

This guide explains how to create plugins for Rox. Plugins can extend both backend and frontend functionality.

## Table of Contents

- [Quick Start](#quick-start)
- [Plugin Structure](#plugin-structure)
- [Plugin Manifest](#plugin-manifest)
- [Backend Plugins](#backend-plugins)
  - [Plugin Context](#plugin-context)
  - [Event System](#event-system)
  - [Custom Routes](#custom-routes)
  - [Scheduled Tasks](#scheduled-tasks)
  - [Configuration Storage](#configuration-storage)
- [Permissions](#permissions)
- [Frontend Plugins](#frontend-plugins)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Quick Start

1. Create a plugin directory:

```bash
mkdir my-plugin
cd my-plugin
```

2. Create `plugin.json` manifest:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample Rox plugin",
  "author": "Your Name",
  "minRoxVersion": "2025.12.0",
  "permissions": ["note:read", "config:read", "config:write"],
  "backend": "index.ts"
}
```

3. Create `index.ts`:

```typescript
import type { RoxPlugin } from "rox/plugins";

const myPlugin: RoxPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",

  onLoad({ events, logger, config }) {
    logger.info("My plugin loaded!");

    events.on("note:afterCreate", ({ note }) => {
      logger.info({ noteId: note.id }, "New note created");
    });
  },

  onUnload() {
    // Cleanup (optional)
  },
};

export default myPlugin;
```

4. Install the plugin:

```bash
bun run plugin install ./my-plugin
```

## Plugin Structure

A typical plugin directory structure:

```
my-plugin/
├── plugin.json          # Required: Plugin manifest
├── index.ts             # Backend entry point
├── frontend/            # Optional: Frontend components
│   └── index.tsx
├── README.md            # Documentation
└── LICENSE              # License file
```

## Plugin Manifest

The `plugin.json` file describes your plugin:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (lowercase, alphanumeric, hyphens) |
| `name` | string | Yes | Human-readable name |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `description` | string | No | Short description |
| `author` | string | No | Author name or organization |
| `repository` | string | No | Repository URL |
| `minRoxVersion` | string | No | Minimum Rox version required |
| `dependencies` | string[] | No | Other plugin IDs that must be loaded first |
| `permissions` | string[] | No | Required permissions (see [Permissions](#permissions)) |
| `backend` | string | No | Path to backend entry point |
| `frontend` | string | No | Path to frontend entry point |
| `configSchema` | object | No | JSON Schema for configuration |

### Example Manifest

```json
{
  "id": "content-filter",
  "name": "Content Filter",
  "version": "1.2.0",
  "description": "Filter notes based on keywords",
  "author": "Rox Community",
  "repository": "https://github.com/example/content-filter",
  "minRoxVersion": "2025.12.0",
  "dependencies": [],
  "permissions": [
    "note:read",
    "note:write",
    "config:read",
    "config:write"
  ],
  "backend": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {
      "keywords": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Keywords to filter"
      },
      "action": {
        "type": "string",
        "enum": ["warn", "hide", "block"],
        "default": "warn"
      }
    }
  }
}
```

## Backend Plugins

### Plugin Context

The `onLoad` function receives a `PluginContext` with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `events` | IEventBus | Event bus for subscribing to lifecycle events |
| `logger` | pino.Logger | Logger namespaced to your plugin |
| `config` | PluginConfigStorage | Plugin-specific configuration storage |
| `baseUrl` | string | Base URL of the Rox instance |
| `roxVersion` | string | Current Rox version |
| `registerScheduledTask` | function | Register a scheduled task |

### Event System

Rox uses an EventBus for plugin communication. Events follow the pattern `{resource}:{timing}{Action}`.

#### Available Events

| Event | Type | Description |
|-------|------|-------------|
| `note:beforeCreate` | Before | Before a note is created (can cancel/modify) |
| `note:afterCreate` | After | After a note is created (notification only) |
| `note:beforeDelete` | Before | Before a note is deleted (can cancel) |
| `note:afterDelete` | After | After a note is deleted (notification only) |
| `user:beforeRegister` | Before | Before user registration (can cancel/modify) |
| `user:afterRegister` | After | After user registration (notification only) |

#### Subscribing to Events

**After Events** (notification only):

```typescript
events.on("note:afterCreate", ({ note }) => {
  logger.info({ noteId: note.id }, "Note created");
});
```

**Before Events** (can cancel or modify):

```typescript
events.onBefore("note:beforeCreate", async ({ content, userId }) => {
  // Check content
  if (containsBannedWords(content)) {
    return { cancel: true, reason: "Content contains banned words" };
  }

  // Modify content
  const sanitized = sanitizeContent(content);
  if (sanitized !== content) {
    return { modified: { content: sanitized, userId } };
  }

  // Allow unchanged
  return {};
});
```

#### Event Data Types

**note:beforeCreate**
```typescript
interface NoteBeforeCreateData {
  content: string;
  userId: string;
  cw?: string | null;
  visibility?: "public" | "home" | "followers" | "specified";
  localOnly?: boolean;
}
```

**note:afterCreate**
```typescript
interface NoteAfterCreateData {
  note: Note;  // Full Note object
}
```

**note:beforeDelete / note:afterDelete**
```typescript
interface NoteDeleteData {
  noteId: string;
  userId: string;
}
```

**user:beforeRegister**
```typescript
interface UserBeforeRegisterData {
  username: string;
  email?: string | null;
}
```

**user:afterRegister**
```typescript
interface UserAfterRegisterData {
  userId: string;
  username: string;
}
```

### Custom Routes

Plugins can register custom API routes under `/api/x/{pluginId}/`:

```typescript
const myPlugin: RoxPlugin = {
  id: "my-plugin",
  // ...

  routes(app) {
    // GET /api/x/my-plugin/status
    app.get("/status", (c) => {
      return c.json({ status: "ok" });
    });

    // POST /api/x/my-plugin/action
    app.post("/action", async (c) => {
      const body = await c.req.json();
      // Process request
      return c.json({ success: true });
    });
  },
};
```

### Scheduled Tasks

Register tasks that run on a schedule:

```typescript
onLoad({ registerScheduledTask, logger }) {
  registerScheduledTask({
    id: "cleanup-task",
    name: "Cleanup Old Data",
    schedule: "1h",  // Run every hour
    runOnStartup: true,
    async handler() {
      logger.info("Running cleanup...");
      // Perform cleanup
    },
  });
}
```

**Schedule formats:**
- `"30s"` - Every 30 seconds
- `"5m"` - Every 5 minutes
- `"1h"` - Every hour
- `"24h"` - Every 24 hours

### Configuration Storage

Store and retrieve plugin-specific configuration:

```typescript
onLoad({ config, logger }) {
  // Read configuration
  const keywords = await config.get<string[]>("keywords") ?? [];

  // Write configuration
  await config.set("keywords", ["nsfw", "spoiler"]);

  // Delete configuration
  await config.delete("oldKey");

  // Get all configuration
  const allConfig = await config.getAll();
}
```

## Permissions

Plugins must declare required permissions in their manifest. The system enforces these permissions at runtime.

### Available Permissions

| Permission | Risk Level | Description |
|------------|------------|-------------|
| `note:read` | Low | Read notes and their content |
| `note:write` | Medium | Create, update, and delete notes |
| `user:read` | Low | Read user profiles and information |
| `user:write` | High | Modify user data and settings |
| `file:read` | Low | Read uploaded files and media |
| `file:write` | Medium | Upload, modify, and delete files |
| `admin:read` | Medium | Read administrative settings and data |
| `admin:write` | High | Modify administrative settings |
| `config:read` | Low | Read plugin configuration |
| `config:write` | Low | Modify plugin configuration |

### Permission Requirements for Events

| Event | Required Permission |
|-------|---------------------|
| `note:beforeCreate` | `note:write` |
| `note:afterCreate` | `note:read` |
| `note:beforeDelete` | `note:write` |
| `note:afterDelete` | `note:read` |
| `user:beforeRegister` | `user:write` |
| `user:afterRegister` | `user:read` |

### Security Notes

- Plugins without a manifest receive **no permissions** by default
- High-risk permission combinations (e.g., `admin:write` + `user:write`) trigger warnings
- Permission violations throw `PluginPermissionError`

## Frontend Plugins

Frontend plugins can register UI components for specific slots:

```tsx
// frontend/index.tsx
import { registerPluginComponent } from "rox/frontend/plugins";

function NoteFooterExtension({ noteId, pluginId }) {
  return (
    <button onClick={() => handleClick(noteId)}>
      Custom Action
    </button>
  );
}

registerPluginComponent("my-plugin", "note:footer", NoteFooterExtension);
```

### Available Slots

| Slot Name | Location | Props |
|-----------|----------|-------|
| `note:footer` | Bottom of note cards | `noteId`, `userId` |
| `note:header` | Top of note cards | `noteId`, `userId` |
| `profile:header` | User profile header | `userId` |
| `settings:panel` | Settings page | `userId` |

## Best Practices

### Error Handling

```typescript
events.on("note:afterCreate", async ({ note }) => {
  try {
    await processNote(note);
  } catch (error) {
    logger.error({ error, noteId: note.id }, "Failed to process note");
    // Don't throw - after events should not crash the server
  }
});
```

### Resource Cleanup

```typescript
let intervalId: ReturnType<typeof setInterval>;

const myPlugin: RoxPlugin = {
  onLoad({ logger }) {
    intervalId = setInterval(() => {
      logger.info("Periodic task");
    }, 60000);
  },

  onUnload() {
    clearInterval(intervalId);
  },
};
```

### Configuration Validation

```typescript
async function validateConfig(config: PluginConfigStorage) {
  const keywords = await config.get<string[]>("keywords");
  if (!Array.isArray(keywords)) {
    await config.set("keywords", []);
  }
}
```

### Logging Best Practices

```typescript
// Good: structured logging with context
logger.info({ noteId, userId, action: "filter" }, "Note filtered");

// Avoid: string interpolation
logger.info(`Note ${noteId} filtered for user ${userId}`);
```

## Examples

### Content Moderation Plugin

```typescript
import type { RoxPlugin } from "rox/plugins";

const moderationPlugin: RoxPlugin = {
  id: "content-moderation",
  name: "Content Moderation",
  version: "1.0.0",

  async onLoad({ events, config, logger }) {
    events.onBefore("note:beforeCreate", async ({ content, userId, cw }) => {
      const blockedWords = await config.get<string[]>("blockedWords") ?? [];

      for (const word of blockedWords) {
        if (content.toLowerCase().includes(word.toLowerCase())) {
          logger.warn({ userId, word }, "Blocked content attempt");
          return { cancel: true, reason: "Content contains blocked words" };
        }
      }

      return {};
    });
  },
};

export default moderationPlugin;
```

### Activity Logger Plugin

```typescript
import type { RoxPlugin } from "rox/plugins";

const loggerPlugin: RoxPlugin = {
  id: "activity-logger",
  name: "Activity Logger",
  version: "1.0.0",

  onLoad({ events, logger }) {
    events.on("note:afterCreate", ({ note }) => {
      logger.info({
        event: "note_created",
        noteId: note.id,
        userId: note.userId,
        visibility: note.visibility,
      });
    });

    events.on("user:afterRegister", ({ userId, username }) => {
      logger.info({
        event: "user_registered",
        userId,
        username,
      });
    });
  },
};

export default loggerPlugin;
```

### Statistics API Plugin

```typescript
import type { RoxPlugin } from "rox/plugins";

let noteCount = 0;

const statsPlugin: RoxPlugin = {
  id: "stats-api",
  name: "Statistics API",
  version: "1.0.0",

  onLoad({ events }) {
    events.on("note:afterCreate", () => {
      noteCount++;
    });
  },

  routes(app) {
    app.get("/stats", (c) => {
      return c.json({
        notesCreatedSinceStartup: noteCount,
        uptime: process.uptime(),
      });
    });
  },
};

export default statsPlugin;
```

## Testing Plugins

Create tests for your plugin:

```typescript
// my-plugin.test.ts
import { describe, it, expect, mock } from "bun:test";
import myPlugin from "./index";

describe("my-plugin", () => {
  it("should have correct metadata", () => {
    expect(myPlugin.id).toBe("my-plugin");
    expect(myPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should handle events correctly", async () => {
    const mockEvents = {
      on: mock(() => () => {}),
      onBefore: mock(() => () => {}),
    };

    const mockContext = {
      events: mockEvents,
      logger: { info: mock(), warn: mock(), error: mock() },
      config: { get: mock(), set: mock() },
      baseUrl: "https://example.com",
      roxVersion: "2025.12.0",
      registerScheduledTask: mock(),
    };

    await myPlugin.onLoad?.(mockContext as any);

    expect(mockEvents.on).toHaveBeenCalled();
  });
});
```

## Troubleshooting

### Plugin not loading

1. Check `plugin.json` syntax is valid JSON
2. Verify `id` matches directory name
3. Check for TypeScript errors in entry point
4. Review server logs for error messages

### Permission errors

```
PluginPermissionError: Plugin 'my-plugin' does not have permission 'note:write'
```

Add the required permission to `plugin.json`:

```json
{
  "permissions": ["note:write"]
}
```

### Hot reload not working

Hot reload requires development mode:

```bash
NODE_ENV=development bun run dev
```

## Support

- [GitHub Issues](https://github.com/Love-Rox/rox/issues)
- [Documentation](https://github.com/Love-Rox/rox/tree/main/docs/plugins)
