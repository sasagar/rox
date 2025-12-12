# DevContainer Development Guide

This guide covers using the DevContainer for Rox development with VS Code or Cursor.

## Overview

The DevContainer provides a fully configured development environment with:

- All required services (PostgreSQL, MariaDB, Dragonfly, Nginx)
- HTTPS support via mkcert
- Pre-installed tools (Bun, Node.js, Claude Code)
- Recommended VS Code extensions
- Persistent data volumes

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- [VS Code](https://code.visualstudio.com/) with [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Or [Cursor](https://cursor.sh/) (DevContainer support built-in)

### Opening in DevContainer

1. Clone the repository:
   ```bash
   git clone https://github.com/Love-Rox/rox.git
   cd rox
   ```

2. Open in VS Code or Cursor:
   ```bash
   code .  # or cursor .
   ```

3. When prompted, click **"Reopen in Container"**
   - Or use Command Palette: `Dev Containers: Reopen in Container`

4. Wait for the container to build (first time takes 2-5 minutes)

5. The post-create script will automatically:
   - Generate SSL certificates
   - Install Claude Code CLI
   - Install dependencies (`bun install`)
   - Compile translations
   - Run database migrations
   - Create necessary directories

6. Start development:
   ```bash
   bun run dev
   ```

## Services

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| PostgreSQL | rox-postgres | 5432 | Primary database |
| MariaDB | rox-mariadb | 3306 | MySQL compatibility testing |
| Dragonfly | rox-dragonfly | 6379 | Redis-compatible cache/queue |
| Nginx | rox-nginx | 443, 80 | HTTPS reverse proxy |

### Database Connections

```bash
# PostgreSQL (default)
DATABASE_URL=postgresql://rox:rox_dev_password@postgres:5432/rox

# MariaDB (for testing)
MARIADB_URL=mysql://rox:rox_dev_password@mariadb:3306/rox
```

### Accessing Services

- **Application**: https://localhost (after starting dev server)
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:3001
- **Drizzle Studio**: Run `bun run db:studio`

## Claude Code Integration

Claude Code CLI is automatically installed in the DevContainer.

### First-Time Setup

```bash
# Option 1: Interactive login
claude login

# Option 2: Set API key in environment
echo "ANTHROPIC_API_KEY=your-key-here" >> .devcontainer/.env
```

### History Persistence

Claude Code configuration and history are stored in the project's `/.claude/` directory:

- **Location**: Project root `/.claude/`
- **Git tracking**: Excluded via `.gitignore`
- **Container mounts**:
  - `/.claude` → `/home/vscode/.claude` (vscode user)
  - `/.claude` → `/root/.claude` (root user)

This setup ensures:
- History persists across container rebuilds
- Each project maintains separate Claude Code history
- Settings are not shared with other projects

### Using Claude Code

```bash
# Start interactive session
claude

# Ask a question
claude "How do I add a new API endpoint?"

# Code review
claude "Review the changes in src/routes/notes.ts"
```

## HTTPS Development

The DevContainer includes Nginx with HTTPS support using mkcert-generated certificates.

### How It Works

1. On first container creation, `post-create.sh` installs mkcert
2. Certificates are generated for `localhost`, `127.0.0.1`, and `::1`
3. Nginx serves HTTPS on port 443

### Certificate Location

```
docker/certs/
├── localhost+2.pem      # Certificate
└── localhost+2-key.pem  # Private key
```

These files are gitignored and generated automatically.

### Manual Certificate Regeneration

```bash
cd docker/certs
mkcert localhost 127.0.0.1 ::1
```

## VS Code Extensions

The following extensions are automatically installed:

| Extension | Purpose |
|-----------|---------|
| oxc.oxc-vscode | Linting and formatting |
| bradlc.vscode-tailwindcss | Tailwind CSS IntelliSense |
| ms-azuretools.vscode-docker | Docker support |
| GitHub.copilot | AI code completion |
| GitHub.copilot-chat | AI chat |
| eamodio.gitlens | Git visualization |
| usernamehw.errorlens | Inline error display |
| christian-kohler.path-intellisense | Path autocompletion |
| formulahendry.auto-rename-tag | Auto rename paired tags |
| streetsidesoftware.code-spell-checker | Spell checking |

## Editor Settings

The DevContainer configures these VS Code settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit"
  }
}
```

## Data Persistence

Named volumes persist data across container rebuilds:

| Volume | Purpose |
|--------|---------|
| rox-devcontainer-home | VS Code user home directory |
| rox-devcontainer-postgres-data | PostgreSQL data |
| rox-devcontainer-mariadb-data | MariaDB data |
| rox-devcontainer-dragonfly-data | Dragonfly data |
| rox-devcontainer-uploads | Uploaded files |

### Resetting Data

```bash
# Remove all DevContainer volumes (WARNING: deletes all data)
docker volume rm rox-devcontainer-home rox-devcontainer-postgres-data rox-devcontainer-mariadb-data rox-devcontainer-dragonfly-data rox-devcontainer-uploads
```

## Troubleshooting

### Container Won't Start

1. Check Docker is running
2. Try rebuilding: `Dev Containers: Rebuild Container`
3. Check Docker logs: `docker logs rox-workspace`

### Port Already in Use

```bash
# Find process using port
lsof -i :5432  # or 3306, 6379, etc.

# Stop conflicting service or change port in .devcontainer/compose.yml
```

### Database Connection Failed

```bash
# Check PostgreSQL is ready
docker exec rox-postgres pg_isready -U rox -d rox

# Check logs
docker logs rox-postgres
```

### SSL Certificate Issues

```bash
# Regenerate certificates
cd docker/certs
rm -f *.pem
mkcert localhost 127.0.0.1 ::1

# Restart Nginx
docker restart rox-nginx
```

### Claude Code Not Working

```bash
# Check installation
which claude
claude --version

# Re-login
claude login

# Check API key
echo $ANTHROPIC_API_KEY
```

## Comparison: DevContainer vs Local Development

| Aspect | DevContainer | Local Development |
|--------|--------------|-------------------|
| Setup time | 2-5 min (first) | 10-30 min |
| Consistency | Identical for all developers | Varies by machine |
| Services | Auto-configured | Manual setup required |
| HTTPS | Built-in | Manual mkcert setup |
| Isolation | Complete | Shared with host |
| Performance | Slight overhead | Native speed |

## Files Reference

| File | Purpose |
|------|---------|
| `.devcontainer/devcontainer.json` | VS Code DevContainer configuration |
| `.devcontainer/compose.yml` | Docker Compose for DevContainer services |
| `.devcontainer/post-create.sh` | Setup script run after container creation |
| `docker/nginx/conf.d/https.conf` | Nginx HTTPS configuration |
| `docker/certs/` | SSL certificates (gitignored) |

## See Also

- [Testing Guide](./testing.md)
- [VPS Docker Deployment](../deployment/vps-docker.md)
- [CLAUDE.md](../../CLAUDE.md) - Project guidelines for Claude Code
