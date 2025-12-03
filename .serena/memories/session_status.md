# Session Status - 2025-12-03

## Current Status

### Recently Completed Features

#### UI Improvements (Latest)
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

## Potential Next Steps
1. Web Push notifications (service worker)
2. Image optimization improvements
3. Server onboarding wizard
4. Performance optimizations
