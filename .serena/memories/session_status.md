# Session Status - 2025-12-09

## Current Status

### Recently Completed Features

#### Production Bug Fixes (Latest - 2025-12-09)
- **Media Proxy for External Images**: External images from remote servers now load through `/api/proxy` to bypass hotlink protection
  - Files: `NoteCard.tsx`, `EmojiPicker.tsx`, `admin/emojis.tsx`
  - Utility: `src/lib/utils/imageProxy.ts` - `getProxiedImageUrl()`

- **canManageCustomEmojis Permission Fix**: Added legacy `isAdmin` fallback for role permission check
  - File: `src/components/ui/EmojiPicker.tsx:80`

- **optionalAuth Middleware for Emojis Route**: Fixed 401/403 errors on `/api/emojis/remote`
  - File: `src/routes/emojis.ts`

#### OAuth 2.0 Implementation (2025-12-08)
- **Full OAuth 2.0 with PKCE support**: Complete OAuth flow for MiAuth compatibility
  - Authorization endpoint: `/oauth/authorize`
  - Token endpoint: `/oauth/token`
  - Token revocation: `/oauth/revoke`
  - Token introspection: `/oauth/introspect`
  - Files: `src/routes/oauth.ts`, `src/services/OAuthService.ts`
  - Database: `oauthApps`, `oauthAuthorizationCodes`, `oauthAccessTokens` tables

- **MiAuth Compatibility Layer**: Legacy Misskey authentication support
  - Session-based flow: `/miauth/:sessionId`
  - Check endpoint: `/api/miauth/:sessionId/check`
  - Files: `src/routes/miauth.ts`, `src/services/MiAuthService.ts`

#### UI Improvements
- **Collapsible Sidebar**: Desktop sidebar can collapse to icon-only mode
  - Uses favicon when collapsed, full logo when expanded
  - Persists state to localStorage via Jotai atom
  - Files: `src/lib/atoms/sidebar.ts`, `src/components/layout/Sidebar.tsx`

- **Scroll-to-Top Button**: Floating button on timeline when scrolling down
  - File: `src/components/ui/ScrollToTop.tsx`

- **Global UI Settings**: Font size and line height now apply to entire UI
  - CSS applies `--rox-font-size` to `html` element
  - All Tailwind rem-based sizes scale accordingly
  - File: `src/styles/globals.css`

- **Note Page Routing Fix**: `/notes/:id` now properly serves HTML pages
  - ActivityPub endpoint only responds to AP Accept headers
  - File: `src/routes/ap/note.ts`

#### Admin Features
- **Federation Admin Page** (`/admin/federation`)
  - View all federated instances
  - Refresh instance info
  - Instance blocking/unblocking

- **Global Timeline** (`/timeline` with type="global")
  - Shows all public posts including remote notes

#### Previous Features (Stable)
- Notification system with SSE real-time updates
- Account migration (Move activity)
- Moderation system (reports, warnings, suspensions)
- Role-based access control
- Instance blocking
- Custom emoji management
- MFM support

### Test Status
- All unit tests passing
- TypeScript type checking passes

## Development Environment

```bash
# Standard dev command
DB_TYPE=postgres \
DATABASE_URL="postgresql://rox:rox_dev_password@localhost:5432/rox" \
STORAGE_TYPE=local LOCAL_STORAGE_PATH=./uploads \
PORT=3000 NODE_ENV=development URL=http://localhost:3000 \
bun run dev
```

## Frontend Development

```bash
cd packages/frontend
bun run dev  # Runs on port 3001
```

## Known Issues / In Progress
- **React Hydration Error #418**: May be related to old cached builds. Hard refresh may not help; try clearing cache completely or rebuilding.
- **WebSocket 1006 errors**: Connection closing before established. Nginx config appears correct; may resolve after hydration error is fixed.

## Potential Next Steps
1. Web Push notifications (service worker)
2. Image optimization improvements
3. Server onboarding wizard
4. Performance optimizations
5. Investigate remaining hydration error after deployment
