# Rox Plugin System

This directory contains documentation for the Rox plugin system.

## Documents

| Document | Description |
|----------|-------------|
| [development-guide.md](./development-guide.md) | Plugin Development Guide (English) |
| [development-guide.ja.md](./development-guide.ja.md) | プラグイン開発ガイド（日本語） |
| [marketplace-specification.md](./marketplace-specification.md) | Plugin Marketplace specification for future implementation |

## Plugin System Overview

The Rox plugin system allows extending the functionality of both backend and frontend components through a modular architecture.

### Current Features (Implemented)

- **EventBus**: Core event system for lifecycle hooks (note:created, user:registered, etc.)
- **PluginLoader**: Loads and manages backend plugins
- **PluginManager**: Handles plugin installation, uninstallation, and configuration
- **Frontend Plugin Registry**: Dynamic component loading for UI extensions
- **Admin API**: REST endpoints for plugin management
- **CLI**: Command-line interface for plugin operations

### Plugin Types

1. **Backend Plugins**: Extend server-side functionality
   - Hook into EventBus events
   - Add new API endpoints
   - Process content

2. **Frontend Plugins**: Extend UI functionality
   - Add new UI components
   - Register extension points
   - Custom themes

### Getting Started

See the [Plugin Development Guide](./development-guide.md) for creating plugins.
Japanese version: [プラグイン開発ガイド](./development-guide.ja.md)

### Admin Plugin Management

The Admin API provides endpoints for managing plugins:

```
GET    /api/admin/plugins          - List all plugins
GET    /api/admin/plugins/:id      - Get plugin details
POST   /api/admin/plugins/install  - Install a plugin
DELETE /api/admin/plugins/:id      - Uninstall a plugin
POST   /api/admin/plugins/:id/enable   - Enable a plugin
POST   /api/admin/plugins/:id/disable  - Disable a plugin
GET    /api/admin/plugins/:id/config   - Get plugin config
PUT    /api/admin/plugins/:id/config   - Update plugin config
```

### CLI Usage

```bash
# Install from Git
bun run plugin install https://github.com/user/my-rox-plugin

# Install from local path
bun run plugin install ./my-plugin

# List plugins
bun run plugin list

# Enable/disable
bun run plugin enable my-plugin
bun run plugin disable my-plugin

# Uninstall
bun run plugin uninstall my-plugin
```

## Future Plans

- **Plugin Marketplace**: Central registry for discovering and installing plugins
- **Plugin Sandboxing**: Enhanced security isolation for plugins
- **Hot Reloading**: Update plugins without server restart
- **Plugin Bundles**: Install multiple related plugins together
