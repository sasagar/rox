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

---

## Frontend Plugins

Plugins can also extend the Rox frontend by injecting React components into predefined slots.

### Plugin Structure with Frontend

```
plugins/
└── my-plugin/
    ├── plugin.json    # Plugin manifest
    ├── index.ts       # Backend plugin entry
    └── frontend.tsx   # Frontend plugin entry
```

### Available Slots

| Slot Name | Location | Props |
|-----------|----------|-------|
| `note:header` | Before note header content | `noteId`, `userId` |
| `note:footer` | After note content, before reactions | `noteId`, `userId` |
| `note:actions` | Additional note action buttons | `noteId`, `userId` |
| `compose:toolbar` | Additional compose toolbar items | `text`, `insertText`, `replyToId` |
| `compose:footer` | Below compose textarea | `text`, `insertText`, `replyToId` |
| `profile:header` | Additional profile header content | `userId`, `username`, `isOwnProfile` |
| `profile:tabs` | Additional profile tabs | `userId`, `username`, `isOwnProfile` |
| `settings:tabs` | Additional settings tabs | `userId` |
| `admin:sidebar` | Additional admin sidebar items | `isAdmin` |
| `admin:dashboard` | Additional dashboard widgets | `isAdmin` |
| `sidebar:bottom` | Before sidebar footer | `isCollapsed` |

### Frontend Plugin Example

```typescript
import type { FrontendPlugin, NoteSlotProps } from "../packages/frontend/src/lib/plugins/types";

// Component for the note:footer slot
function MyNoteFooter({ noteId, pluginId }: NoteSlotProps) {
  return (
    <div className="text-xs text-gray-500">
      Plugin: {pluginId} | Note: {noteId}
    </div>
  );
}

const myFrontendPlugin: FrontendPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",

  slots: {
    "note:footer": MyNoteFooter,
  },

  onLoad() {
    console.log("Frontend plugin loaded");
  },
};

export default myFrontendPlugin;
```

### Registering Frontend Plugins

```typescript
import { pluginRegistry } from "@/lib/plugins";
import myFrontendPlugin from "./plugins/my-plugin/frontend";

// Register the plugin
await pluginRegistry.register(myFrontendPlugin);

// Enable/disable
pluginRegistry.disable("my-plugin");
pluginRegistry.enable("my-plugin");

// Unregister
await pluginRegistry.unregister("my-plugin");
```

### Using PluginSlot in Components

```tsx
import { PluginSlot } from "@/lib/plugins";

function MyComponent({ note }) {
  return (
    <div>
      <PluginSlot
        slot="note:header"
        props={{ noteId: note.id, userId: note.userId }}
      />
      <div>{note.content}</div>
      <PluginSlot
        slot="note:footer"
        props={{ noteId: note.id, userId: note.userId }}
        className="mt-2"
      />
    </div>
  );
}
```

### Frontend Plugin Hooks

```typescript
import {
  usePlugins,
  useEnabledPlugins,
  useHasSlotPlugins,
  usePluginRegistry,
} from "@/lib/plugins";

function PluginManager() {
  const plugins = usePlugins();
  const enabledPlugins = useEnabledPlugins();
  const hasNoteFooterPlugins = useHasSlotPlugins("note:footer");
  const { register, unregister, enable, disable } = usePluginRegistry();

  return (
    <div>
      <p>Total plugins: {plugins.length}</p>
      <p>Enabled: {enabledPlugins.length}</p>
      {hasNoteFooterPlugins && <p>Note footer plugins available</p>}
    </div>
  );
}
```

---

## Plugin Distribution

### Plugin CLI

Rox provides a CLI for managing plugins:

```bash
# Install from GitHub
bun run plugin install https://github.com/user/my-rox-plugin

# Install from local path
bun run plugin install ./my-plugin

# Force reinstall
bun run plugin install https://github.com/user/plugin --force

# List installed plugins
bun run plugin list

# Enable/disable a plugin
bun run plugin enable my-plugin
bun run plugin disable my-plugin

# Show plugin details
bun run plugin info my-plugin

# Uninstall a plugin
bun run plugin uninstall my-plugin
```

### Plugin Package Format

A complete plugin package should have the following structure:

```
my-plugin/
├── plugin.json      # Plugin manifest (required)
├── index.ts         # Backend entry point
├── frontend.tsx     # Frontend entry point (optional)
├── README.md        # Documentation
└── LICENSE          # License file
```

### Plugin Manifest (plugin.json)

The manifest file defines your plugin's metadata and configuration:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A description of what the plugin does",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://example.com/my-plugin",
  "repository": "https://github.com/user/my-plugin",
  "minRoxVersion": "2025.12.0",
  "permissions": ["note:read", "note:write", "config:read", "config:write"],
  "dependencies": [],
  "backend": "index.ts",
  "frontend": "frontend.tsx",
  "keywords": ["example", "demo"],
  "configSchema": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean" },
      "keywords": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

### Available Permissions

| Permission | Description |
|------------|-------------|
| `note:read` | Read note data |
| `note:write` | Create/modify/delete notes |
| `user:read` | Read user data |
| `user:write` | Modify user data |
| `config:read` | Read plugin configuration |
| `config:write` | Write plugin configuration |
| `admin:read` | Read admin data |
| `admin:write` | Modify admin settings |
| `storage:read` | Read from file storage |
| `storage:write` | Write to file storage |

### Publishing Your Plugin

1. **Create a GitHub repository** for your plugin
2. **Include a valid `plugin.json`** manifest
3. **Test your plugin** thoroughly
4. **Document your plugin** in README.md
5. **Share the repository URL** for installation

Users can install your plugin with:

```bash
bun run plugin install https://github.com/your-username/your-plugin
```

### Best Practices

1. **Use semantic versioning** for your plugin version
2. **Declare minimum Rox version** compatibility
3. **Request only necessary permissions**
4. **Handle errors gracefully** - don't break core functionality
5. **Clean up in onUnload** - remove subscriptions and resources
6. **Use the provided logger** - don't use console.log directly
7. **Write tests** for your plugin logic
