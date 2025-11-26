// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages, GetConfigResponse } from 'waku/router';

// prettier-ignore
import type { getConfig as File_UsernameIndex_getConfig } from './pages/[username]/index';
// prettier-ignore
import type { getConfig as File_NotesNoteId_getConfig } from './pages/notes/[noteId]';

// prettier-ignore
type Page =
| ({ path: '/[username]' } & GetConfigResponse<typeof File_UsernameIndex_getConfig>)
| { path: '/admin/invitations'; render: 'dynamic' }
| { path: '/admin/roles'; render: 'dynamic' }
| { path: '/admin/settings'; render: 'dynamic' }
| { path: '/'; render: 'dynamic' }
| { path: '/login'; render: 'dynamic' }
| ({ path: '/notes/[noteId]' } & GetConfigResponse<typeof File_NotesNoteId_getConfig>)
| { path: '/settings'; render: 'dynamic' }
| { path: '/signup'; render: 'dynamic' }
| { path: '/timeline'; render: 'dynamic' };

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>;
  }
  interface CreatePagesConfig {
    pages: Page;
  }
}
