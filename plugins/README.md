# Rox Plugins

This directory contains plugins that extend Rox functionality.

## Sample Plugins

### activity-logger

A simple plugin that logs all note and user activity. Useful for debugging and understanding the plugin event system.

**Features:**
- Logs note creation/deletion events
- Logs user registration events
- Provides a `/api/x/activity-logger/status` endpoint

### auto-cw

Automatically adds content warnings to notes containing specific keywords.

**Features:**
- Configurable keyword list
- Customizable CW text
- Can be enabled/disabled via configuration
- Provides `/api/x/auto-cw/status` endpoint

## Creating Your Own Plugin

### Basic Structure

```
plugins/
└── my-plugin/
    ├── plugin.json    # Plugin manifest (optional)
    └── index.ts       # Plugin entry point
```

### Minimal Plugin Example

```typescript
import type { RoxPlugin } from "../packages/backend/src/plugins/types/plugin";

const myPlugin: RoxPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",

  onLoad({ events, logger, config }) {
    logger.info("My plugin loaded!");

    // Subscribe to events
    events.on("note:afterCreate", ({ note }) => {
      logger.info({ noteId: note.id }, "Note created");
    });
  },
};

export default myPlugin;
```

### Plugin Manifest (plugin.json)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Description of my plugin",
  "author": "Your Name",
  "minRoxVersion": "2025.12.0",
  "permissions": ["note:read"],
  "backend": "index.ts"
}
```

### Available Events

#### After Events (Notification Only)
- `note:afterCreate` - Fired after a note is created
- `note:afterDelete` - Fired after a note is deleted
- `user:afterRegister` - Fired after a user registers

#### Before Events (Can Cancel/Modify)
- `note:beforeCreate` - Can cancel or modify note creation
- `note:beforeDelete` - Can cancel note deletion
- `user:beforeRegister` - Can cancel or modify registration

### Plugin Context

The `onLoad` function receives a context object with:

- `events` - EventBus for subscribing to lifecycle events
- `logger` - Pino logger namespaced to your plugin
- `config` - Persistent configuration storage
- `registerScheduledTask()` - Register recurring tasks
- `baseUrl` - The instance's base URL
- `roxVersion` - Current Rox version

### Adding Custom Routes

Plugins can register routes under `/api/x/{pluginId}/`:

```typescript
routes(app) {
  app.get("/status", (c) => c.json({ status: "ok" }));
  app.post("/action", async (c) => {
    const body = await c.req.json();
    // Handle action
    return c.json({ success: true });
  });
}
```

### Configuration Storage

Plugins can store persistent configuration:

```typescript
// Read config
const value = await config.get<string>("key");

// Write config
await config.set("key", "value");

// Delete config
await config.delete("key");

// Get all config
const all = await config.getAll();
```

## Environment Variables

- `PLUGIN_DIRECTORY` - Directory to load plugins from (default: `./plugins`)
