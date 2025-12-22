# Rox Plugin Marketplace Specification

This document outlines the specification for the Rox Plugin Marketplace, a separate service for discovering, publishing, and managing Rox plugins.

## Overview

The Rox Plugin Marketplace is designed as a **separate service** from the main Rox application. It serves as a central registry for plugins, enabling users to discover, install, and update plugins for their Rox instances.

## Architecture

### Separation of Concerns

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Rox Instance  │────▶│  Plugin Marketplace │◀────│  Plugin Authors │
│   (Consumer)    │     │    (Central Hub)    │     │   (Publishers)  │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
         │                        │
         │                        │
         ▼                        ▼
  Local Plugin Dir         Plugin Registry DB
```

### Core Components

1. **Marketplace Web Application**
   - Plugin discovery and search
   - Plugin details and documentation
   - Author profiles and verification
   - Download statistics and ratings

2. **API Service**
   - REST API for plugin metadata
   - Download endpoint for plugin archives
   - Webhook notifications for updates
   - Rate limiting and authentication

3. **Plugin Registry Database**
   - Plugin metadata storage
   - Version history
   - Download statistics
   - User reviews and ratings

4. **Build Service** (optional)
   - Automated plugin validation
   - Security scanning
   - Build artifact generation

## API Specification

### Base URL

```
https://marketplace.rox.example.com/api/v1
```

### Endpoints

#### Search Plugins

```http
GET /plugins?q={query}&category={category}&sort={sort}&page={page}&limit={limit}
```

**Query Parameters:**
- `q`: Search query (name, description, keywords)
- `category`: Plugin category filter
- `sort`: Sort order (`downloads`, `updated`, `rating`, `name`)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)

**Response:**
```json
{
  "plugins": [
    {
      "id": "activity-logger",
      "name": "Activity Logger",
      "version": "1.2.0",
      "description": "Logs all note activity for auditing",
      "author": {
        "name": "Rox Team",
        "verified": true
      },
      "downloads": 1523,
      "rating": 4.5,
      "categories": ["monitoring", "admin"],
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### Get Plugin Details

```http
GET /plugins/{pluginId}
```

**Response:**
```json
{
  "id": "activity-logger",
  "name": "Activity Logger",
  "version": "1.2.0",
  "description": "Logs all note activity for auditing and compliance",
  "longDescription": "# Activity Logger\n\nFull markdown documentation...",
  "author": {
    "id": "rox-team",
    "name": "Rox Team",
    "email": "plugins@rox.example.com",
    "verified": true
  },
  "repository": "https://github.com/rox-team/activity-logger",
  "homepage": "https://plugins.rox.example.com/activity-logger",
  "license": "MIT",
  "categories": ["monitoring", "admin"],
  "keywords": ["logging", "audit", "activity"],
  "permissions": ["note:read", "admin:read"],
  "minRoxVersion": "2025.1.0",
  "maxRoxVersion": null,
  "dependencies": [],
  "screenshots": [
    "https://cdn.rox.example.com/plugins/activity-logger/screenshot1.png"
  ],
  "downloads": 1523,
  "rating": 4.5,
  "reviewCount": 23,
  "versions": [
    { "version": "1.2.0", "releaseDate": "2025-01-15", "changelog": "..." },
    { "version": "1.1.0", "releaseDate": "2025-01-01", "changelog": "..." }
  ],
  "createdAt": "2024-06-01T00:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

#### Get Plugin Versions

```http
GET /plugins/{pluginId}/versions
```

**Response:**
```json
{
  "versions": [
    {
      "version": "1.2.0",
      "releaseDate": "2025-01-15T10:30:00Z",
      "changelog": "- Added new logging format\n- Fixed memory leak",
      "minRoxVersion": "2025.1.0",
      "downloads": 523,
      "sha256": "abc123..."
    }
  ]
}
```

#### Download Plugin

```http
GET /plugins/{pluginId}/download?version={version}
```

Returns a plugin archive (`.zip` or `.tar.gz`) containing:
- `plugin.json` - Plugin manifest
- Source files (backend/frontend)
- Assets and documentation

#### Check for Updates

```http
POST /plugins/check-updates
```

**Request Body:**
```json
{
  "plugins": [
    { "id": "activity-logger", "version": "1.1.0" },
    { "id": "content-filter", "version": "2.0.0" }
  ],
  "roxVersion": "2025.1.0"
}
```

**Response:**
```json
{
  "updates": [
    {
      "id": "activity-logger",
      "currentVersion": "1.1.0",
      "latestVersion": "1.2.0",
      "compatible": true,
      "changelog": "..."
    }
  ]
}
```

### Publisher API

#### Publish Plugin Version

```http
POST /publish
Authorization: Bearer {api_token}
Content-Type: multipart/form-data
```

**Form Data:**
- `archive`: Plugin archive file
- `changelog`: Release notes (markdown)
- `prerelease`: Boolean flag for pre-release versions

#### Publisher Registration

```http
POST /publishers/register
```

**Request Body:**
```json
{
  "name": "Publisher Name",
  "email": "publisher@example.com",
  "github": "github-username"
}
```

## Plugin Categories

Standard categories for organizing plugins:

| Category | Description |
|----------|-------------|
| `admin` | Administration and moderation tools |
| `analytics` | Statistics and analytics |
| `appearance` | Themes and visual customization |
| `automation` | Bots and automated actions |
| `content` | Content creation and management |
| `federation` | ActivityPub and federation features |
| `integration` | Third-party service integrations |
| `media` | Image, video, and audio processing |
| `moderation` | Content moderation tools |
| `monitoring` | Logging and monitoring |
| `security` | Security enhancements |
| `social` | Social features and interactions |

## Security Considerations

### Plugin Verification

1. **Source Verification**
   - GitHub/GitLab repository linking
   - Commit signature verification
   - Author identity verification

2. **Automated Scanning**
   - Static code analysis
   - Dependency vulnerability scanning
   - Malware detection

3. **Manual Review** (for verified publishers)
   - Code review for suspicious patterns
   - Permission justification review

### Trust Levels

| Level | Badge | Requirements |
|-------|-------|--------------|
| Unverified | - | Basic registration |
| Verified | ✓ | Email + GitHub verification |
| Trusted | ★ | History of safe plugins + manual review |
| Official | ★★ | Rox team or partner organizations |

## Integration with Rox

### Installation Flow

1. User browses marketplace (web or CLI)
2. Clicks "Install" on desired plugin
3. Rox instance fetches plugin from marketplace API
4. Plugin is validated locally (manifest, signatures)
5. Plugin is installed to local plugin directory
6. Instance restart applies plugin

### Update Notifications

Rox instances can periodically check the marketplace for updates:

```typescript
// In admin panel or background job
const updates = await fetch(
  `${MARKETPLACE_URL}/api/v1/plugins/check-updates`,
  {
    method: 'POST',
    body: JSON.stringify({
      plugins: installedPlugins.map(p => ({ id: p.id, version: p.version })),
      roxVersion: ROX_VERSION
    })
  }
);
```

## Implementation Roadmap

### Phase 1: Basic Registry
- [ ] Plugin submission via Git URL
- [ ] Basic search and discovery
- [ ] Download endpoint
- [ ] Version management

### Phase 2: Enhanced Features
- [ ] User accounts and API tokens
- [ ] Reviews and ratings
- [ ] Download statistics
- [ ] Categories and tags

### Phase 3: Security & Trust
- [ ] Publisher verification
- [ ] Automated security scanning
- [ ] Signing and verification
- [ ] Abuse reporting

### Phase 4: Advanced Features
- [ ] Dependency resolution
- [ ] Automatic updates (opt-in)
- [ ] Plugin bundles
- [ ] Private/enterprise registries

## Technical Stack Recommendations

For the marketplace service:

| Component | Recommended Technology |
|-----------|----------------------|
| Backend | Hono / Express / Fastify |
| Database | PostgreSQL |
| Search | Meilisearch / Typesense |
| Storage | S3-compatible (plugin archives) |
| CDN | Cloudflare / AWS CloudFront |
| Auth | OAuth (GitHub, GitLab) |

## Open Questions

1. **Monetization**: Should the marketplace support paid plugins?
2. **Hosting**: Self-hosted vs. managed marketplace service?
3. **Namespace**: Should plugin IDs be globally unique or scoped to publishers?
4. **Review Process**: Manual review for all plugins or only verified publishers?

---

*This specification is a draft and subject to change based on community feedback.*
