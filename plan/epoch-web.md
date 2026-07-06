# Epoch Web Platform — Phased Build Plan

A standalone web application replacing the VS Code extension dependency, with Monaco-based file management and multi-user workspace access via the existing bridge architecture.

**Updated** · 2026-07-05 (git history) · 5 phases · ~12 months estimated

---

## Implementation Status

### Phase 1 — Web Shell ✅ (complete)

Built and deployed as `epoch-web:latest` Docker image on port 3003. Bridge runs as a host process on port 3002; containers reach it via `host.docker.internal`.

**Startup**: two-terminal workflow — `.\start-bridge.ps1` (Terminal 1) then `.\start-epoch.ps1` (Terminal 2).

**Completed deliverables:**

- ✅ Next.js 15 App Router · `output: standalone` · Docker service on port 3003
- ✅ Catch-all API proxy (`app/api/[...path]/route.ts`) — reads `BRIDGE_URL` at runtime so env works inside Docker
- ✅ Sidebar — node tree with expand/collapse hierarchy, click to select, + buttons to create children, inline search/filter
- ✅ Monaco editor for `content.tex` — LaTeX syntax highlighting, auto-save (1.5 s debounce), Ctrl+S manual save, save-status indicator
- ✅ Compile → PDF — POST `/api/compile` → blob URL → iframe viewer
- ✅ Excalidraw canvas tab — iframe embed pointing at port 3001
- ✅ **File manager** (Files tab) — raw workspace filesystem tree with lazy-load per directory; hover actions: rename inline, delete with confirm, new file, new folder, upload; text and image preview pane; bridge endpoints `GET/POST/DELETE /api/files/*` with path-traversal and `.git` guards
- ✅ Node metadata header (NodeHeader) — click-to-edit title, status dropdown (Sketch / Conjecture / Hypothesis / Theorem with colour coding), description textarea (auto-save 1.5 s), tag chips with add/remove, delete-with-confirm
- ✅ Sidebar inline rename — double-click title to rename folder slug + update `node.json` title via move + PUT
- ✅ Delete node — DELETE `/api/nodes/:path` with git unstage + `rm -rf` + commit
- ✅ Bridge: `removeNode` and `moveNode` added to `workspace.ts`; DELETE and move routes added to `nodes.ts`

**Original Phase 1 scope — now complete:**
- ✅ Git log view (read-only commit history panel) — shipped 2026-07-05
- ✅ validationPath / DAG dependency UI — shipped 2026-07-05

### Phase 1 UI — VS Code webview layout ✅ (complete, 2026-07-05)

Redesigned the workspace UI to match the VS Code extension's three-layout pattern, ported to the web app.

**New components:**
- ✅ **ActivityBar** (`components/ActivityBar.tsx`) — 40 px icon bar; two modes: node tree / file explorer; click same icon collapses the side panel; active indicator rail on left edge
- ✅ **LayoutTabs** (`components/LayoutTabs.tsx`) — A/B/C switcher in topbar with underline-active style
- ✅ **BreadcrumbBar** (`components/BreadcrumbBar.tsx`) — `workspace › slug(s) › node title` display
- ✅ **ContentArea** (`components/ContentArea.tsx`) — extracted tab bar (LaTeX | PDF | Canvas) + NodeHeader + editor/viewer, shared across Analytical and Focus layouts
- ✅ **ContextPanel** (`components/ContextPanel.tsx`) — right panel (Analytical only): compile button, PDF status, status badge, tags

**New layouts (`layouts/`):**
- ✅ **AnalyticalLayout** — 3-column: ActivityBar | collapsible SidePanel | ContentArea | ContextPanel (240 px)
- ✅ **FocusLayout** — ActivityBar | (optional side panel) | centered ContentArea (max 900 px) | bottom drawer with Compile + Nodes tabs
- ✅ **NavigatorLayout** — ActivityBar | card grid with status filter chips (All/Sketch/Conjecture/Hypothesis/Theorem) | detail panel slide-in; "Edit Node →" jumps to Analytical

**Updated:**
- ✅ `globals.css` — full Catppuccin Mocha official palette (`#1e1e2e` base, `#89b4fa` blue, `#fab387` peach, `#a6e3a1` green); status badge + tag chip global classes
- ✅ `PdfPanel.tsx` — refactored to pure viewer (takes `pdfUrl / compiling / error` props); compile button removed to ContextPanel / FocusDrawer
- ✅ `workspace/page.tsx` — compile state lifted here (was in PdfPanel); routes to the 3 layouts; `onSave` typed `Promise<void>` throughout

**Deployment note:** Dockerfile copies pre-built `.next/standalone`. Build sequence after source changes:
```
cd epoch-web && npx next build
docker compose -f docker-compose.epoch-stack.yml build epoch-web
docker rm -f epoch-web && docker compose -f docker-compose.epoch-stack.yml up -d epoch-web
```

**Known gaps:**
- ❌ Canvas tab still shows in ContentArea but Excalidraw embed (port 3001) must be running separately
- ❌ Navigator layout: clicking the ActivityBar icons doesn't open the side panel (panel always hidden in Navigator mode by design — switch to Analytical for the panel)
- ❌ Bridge process is not persisted by the Docker stack; must be started separately with `.\start-bridge.ps1` in a dedicated terminal

### Phase 1 Addition — Git History Tab ✅ (complete, 2026-07-05)

History tab added to both epoch-web and the VS Code extension, showing recent commits for the workspace or a selected node.

**New / updated files:**
- ✅ `src/core/workspace.ts` — `getNodeHistory(workspaceDir, nodePath?, limit)` replaces `getWorkspaceHistory`; uses native `git log` via `runGit` (isomorphic-git dropped for this path — Windows path issues); walks up to parent `.git` for nested workspaces (e.g. `three-distance/` inside the Epoch repo)
- ✅ `src/bridge/routes/nodes.ts` — `GET /api/nodes/log?path=<nodePath>&limit=N` registered before `/:encodedPath` to avoid parameter capture
- ✅ `epoch-web/lib/api.ts` — `CommitEntry` interface + `getNodeLog(nodePath, limit)` function
- ✅ `epoch-web/components/GitLog.tsx` — renders commit list: 7-char hash, message, author, relative time ("2m ago", "3d ago", etc.); shows "Node History" or "Workspace History" header
- ✅ `epoch-web/components/ContentArea.tsx` — History tab added to tab bar
- ✅ `src/webview/types.ts` — `CommitEntry`, `getNodeHistory` message (→ extension), `nodeHistory` message (← extension)
- ✅ `src/webview/components/GitLog.tsx` — same presentational component, no message-passing (App.tsx owns the data flow)
- ✅ `src/webview/components/ContentArea.tsx` — History tab added; tab bar now visible across all three content modes (Editor / PDF / History)
- ✅ `src/webview/App.tsx` — `viewMode` extended to `'edit' | 'pdf' | 'history'`; `handleShowHistory` sends `getNodeHistory`; handles `nodeHistory` response
- ✅ `src/extension/extension.ts` — `getNodeHistory` case calls `getNodeHistory(workspaceDir, msg.nodePath)` and posts `nodeHistory` back
- ✅ `src/webview/layoutProps.ts` — `showHistory`, `commits`, `loadingHistory`, `historyError`, `onShowHistory` added to `SharedLayoutProps`; all three layouts updated

### Phase 1 Addition — Verification, DAG Display & Thumbnails ✅ (complete, 2026-07-05)

Validation path editing, promotion warnings, DAG graph visualisation, and thumbnail support added to both epoch-web and VS Code extension.

**Completed deliverables:**

- ✅ **Bridge: `GET /api/nodes` now includes `validationPath`** — each node summary exposes its full dep list so the frontend can render DAGs without extra fetches
- ✅ **Bridge: `PUT /api/nodes/:path` now accepts `validationPath`** — persists dep edits from the UI
- ✅ **Bridge: `GET /api/nodes/:path/thumbnail`** — serves `data/thumbnail.png` for any node (404 if absent); `Cache-Control: public, max-age=60`
- ✅ **`epoch-web/lib/api.ts`** — `ValidationPathEntry` interface; `validationPath` on `NodeSummary` and `NodeDetail`; `validationPath` on `UpdateNodeOpts`; `getThumbnailUrl(path)` helper
- ✅ **`epoch-web/layouts/types.ts`** — `nodeValidationPath: ValidationPathEntry[]` and `onValidationPathChange` added to `LayoutProps`
- ✅ **`epoch-web/app/workspace/page.tsx`** — `nodeValidationPath` state wired up; loaded in `selectNode`, reset in `handleDeleted`, threaded through `lp`
- ✅ **`epoch-web/components/NodeHeader.tsx`** — full validation path section: dep chips with live-status lookup, add-dep picker (inline `<select>`), remove dep button; promotion warning row when any dep's live status is below the node's current status; all edits auto-persist via `updateNode`
- ✅ **`epoch-web/components/ContentArea.tsx`** — threads `allNodes`, `nodeValidationPath`, `onValidationPathChange` down to `NodeHeader`
- ✅ **`epoch-web/layouts/AnalyticalLayout.tsx` + `FocusLayout.tsx`** — pass new props from `LayoutProps` to `ContentArea`
- ✅ **`epoch-web/components/DagCanvas.tsx`** (new) — SVG-based layered DAG graph; nodes ranked by longest dep chain (sources at bottom, sinks at top); bezier edges with arrowheads; status color stripe + title + path text per node; thumbnail inset via `<image href={thumbnailUrl}>`; click navigates to node + switches to Analytical layout; pan by drag
- ✅ **`epoch-web/layouts/NavigatorLayout.tsx`** — Grid / Graph toggle in topbar; Graph mode renders `DagCanvas`; detail panel in Grid mode now shows Validation Path section
- ✅ **`src/webview/components/NodeEditor.tsx`** — promotion warning: when upgrading status, any dep whose live status is below the target is listed in an amber warning box (soft warning, not a hard block)
- ✅ **`src/webview/components/DagCanvas.tsx`** (new) — same layered DAG for VS Code webview, using VS Code CSS variables; no thumbnails (filesystem access via message-passing is deferred)
- ✅ **`src/webview/layouts/NavigatorLayout.tsx`** — Grid / Graph toggle added to topbar; Graph mode renders `DagCanvas` with all workspace nodes
- ✅ **`src/webview/index.css`** — `.blocking-deps-warning` style for promotion warning

**Key design decisions:**
- Promotion warning is a **soft advisory** (amber row), not a hard block — the user can still save any status
- DAG layout uses **longest-path-from-source** layering: sources (no deps) at bottom, sinks (most derived) at top; this places Theorems above Hypotheses above Conjectures above Sketches
- Thumbnails are served via existing files proxy at `/api/nodes/:path/thumbnail`; SVG `<image>` elements with 404 URLs silently render nothing (no broken-image icon)
- VS Code webview thumbnails deferred — would require base64 message-passing from extension host

**Post-ship hot-fix (2026-07-05):**
- ✅ Bridge `GET /api/nodes` now returns `tags ?? []` and `validationPath ?? []` — prevents Navigator crash for `node.json` files that predate these fields
- ✅ epoch-web `NavigatorLayout`: `n.tags?.length ?? 0` guard in card grid; `DagCanvas`: `n.validationPath ?? []` in layout algorithm
- ✅ VS Code webview `NavigatorLayout`: `selectedEntry.node.validationPath?.length ?? 0` guard in detail panel

---

## Cross-cutting — VS Code Extension Connectivity

The VS Code extension remains a supported client throughout all phases. It connects to whichever server it is pointed at — local bridge or remote epoch-web — via a single configurable base URL.

### Extension setting

Add one VS Code workspace setting:

```jsonc
// .vscode/settings.json  (or user settings)
{
  "epoch.serverUrl": "http://localhost:3002"   // local default
  // "epoch.serverUrl": "https://epoch.example.com"  // remote
}
```

All HTTP calls in the extension read this value instead of the current hardcoded `localhost:3002`. The QR code modal already derives its URL from `getLocalIP()` — when `serverUrl` is set to a remote host it should show that instead.

### Authentication (Phase 3+)

When `serverUrl` points to a remote server with auth enabled, the extension needs a credential. Two options, in order of preference:

1. **API token** — user generates a long-lived token from their account settings page on epoch-web; stored in VS Code's `SecretStorage` (encrypted, per-machine). Extension sends it as `Authorization: Bearer <token>` on every request.
2. **Gitea OAuth device flow** — extension initiates device-flow OAuth against the Gitea instance; no browser redirect needed. Stores the resulting token the same way.

The local bridge path (`localhost:3002`) requires no auth — behaviour unchanged for solo local use.

### MCP endpoint

The MCP SSE endpoint used by Claude Code stays on the **local bridge** regardless of where the REST API lives. Claude Code connects to `localhost:3002/mcp` via `.mcp.json` — this never routes through the remote server.

When epoch-web absorbs the bridge REST API in Phase 2–3, the bridge process continues to run locally on port 3002 for MCP only. The extension can point its REST calls at the remote server while Claude Code still connects to the local MCP endpoint.

### What the extension does at each phase

| Phase | Extension REST target | Extension MCP | Auth needed |
|---|---|---|---|
| 1 | `localhost:3002` (bridge) | `localhost:3002/mcp` | No |
| 2 | `localhost:3002` or `remote:443` | `localhost:3002/mcp` | No |
| 3+ | `remote:443` (epoch-web) | `localhost:3002/mcp` | API token |

---

## Phase 1 — Web Shell
*~8 weeks · single user, single workspace · **✅ shipped***

Replace the VS Code webview with a self-hosted web app. Everything the extension does today — file tree, editor, compile, canvas — accessible from any browser.

### Stack

- **Next.js 15 App Router** — standalone output, proxies REST calls to the bridge at runtime via catch-all route handler (not build-time rewrites)
- **Monaco** via `@monaco-editor/react` for `.tex` editing with LaTeX syntax highlighting
- Bridge remains on port 3002 (host process); `epoch-web` on port 3003 (Docker)

### Deliverables

- ✅ Node file tree sidebar — list, create, navigate, search/filter, inline rename
- ✅ Monaco editor for `content.tex` — auto-save + manual save
- ✅ Compile button → in-browser PDF viewer panel
- ✅ Excalidraw canvas embedded as an iframe tab
- ✅ Node metadata panel — title, status, description, tags, delete
- ✅ File manager — raw workspace filesystem tree, upload, create, delete, rename, preview
- ✅ Git log view (read-only) — shipped 2026-07-05
- ✅ validationPath / DAG dependency UI — shipped 2026-07-05 (see Phase 1 Addition above)

### Not in Phase 1

Authentication, multiple workspaces, real-time collaboration, Gitea integration.

### Key Decision — Next.js over plain Vite + Express

Next.js API routes proxy to the bridge rather than importing `workspace.ts` directly. The bridge stays on port 3002 for MCP/Excalidraw. Its REST routes are gradually absorbed into Next.js in Phase 2, leaving the bridge to serve only the MCP SSE endpoint.

---

## Phase 2 — Multi-workspace
*~5 weeks · workspace picker, Gitea API · **✅ complete (2026-07-05)***

A home screen lists and creates workspaces backed by Gitea repos. The bridge becomes stateless — workspace path is passed per request rather than baked in at startup.

### Completed so far (2026-07-05)

- ✅ **Bridge: `WORKSPACES_BASE_DIR`** — auto-detected as `path.dirname(WORKSPACE_DIR)`; override via env var
- ✅ **Bridge: `x-workspace` middleware** — reads header, validates name against allowlist pattern, resolves path, stores in `res.locals.workspaceDir`; path-traversal guard
- ✅ **Bridge: `withWorkspace()` wrapper** — caches router instances per resolved dir; all workspace-scoped routes (nodes, files, compile, pdf, convert) use it
- ✅ **Bridge: `GET /api/workspaces`** — scans base dir, returns only subdirs with `manifest.json`; includes `displayName`, `description`, `nodeCount`, `updatedAt`, `hasRemote`
- ✅ **Bridge: `POST /api/workspaces`** — creates new workspace via `initWorkspace`; validates name format; returns 409 if already exists; optionally creates Gitea repo + pushes initial commit (`createGiteaRepo: true`)
- ✅ **Bridge: Gitea API integration** (`src/bridge/routes/workspaces.ts`):
  - `GET /api/workspaces/gitea` — lists all Gitea repos for the configured user; flags each as `isCloned` if found locally
  - `POST /api/workspaces/:name/clone` — git clones a Gitea repo into `WORKSPACES_BASE_DIR` with credential-injected URL
  - `GET /api/workspaces/:name/remote` — returns `RemoteInfo` (branch, ahead, behind, displayUrl) from `getRemoteInfo()`
  - `POST /api/workspaces/:name/push` — auto-stages + commits any unsaved changes, then pushes; returns `SyncResult`
  - `POST /api/workspaces/:name/pull` — `--ff-only` pull; returns `SyncResult`
  - Gitea credentials read from env at call time: `GITEA_URL`, `GITEA_USER`, `GITEA_PASS`; Basic auth header injected server-side, never exposed to browser
- ✅ **`epoch-web/lib/api.ts`** — `setApiBase(base)` / `getApiBase()`; all workspace-scoped calls use `_apiBase` (default `/api`); `WorkspaceSummary` (with `hasRemote`), `GiteaRepo`, `RemoteInfo`, `SyncResult` types; `listWorkspaces()`, `createWorkspace()`, `listGiteaRepos()`, `cloneFromGitea()`, `getWorkspaceRemote()`, `pushWorkspaceSync()`, `pullWorkspaceSync()`
- ✅ **Home screen at `/`** — `WorkspaceHome` component: card grid of local workspaces + Gitea repos section; push/pull buttons on cards with `hasRemote`; Clone button on uncloned Gitea repos; "Also create Gitea repo" checkbox in create form; toast-style sync result display; Catppuccin Mocha styling
- ✅ **`/ws/[name]`** — full workspace UI; `setApiBase('/ws/${name}/api')` on mount, cleanup on unmount
- ✅ **`/ws/[name]/api/[...path]`** — API proxy that forwards `x-workspace: name` header to bridge

### Completed (Phase 2 fully shipped 2026-07-05)

- ✅ **URL-scoped node routing** — `?node=<encoded-path>` query param; `selectNode` calls `router.replace` to push the URL; on mount, auto-selects from `?node=` after nodes load; `handleDeleted` + `handleRename` keep the URL in sync; shareable, bookmarkable, browser back/forward navigable

### Deliverables

- Home screen with workspace cards drawn from the Gitea repo list
- Create workspace → creates Gitea repo + initialises `manifest.json`
- Clone existing Gitea repo into workspace
- URL-scoped routing: `/ws/[name]/nodes/[path]`
- Push/pull to Gitea from the browser
- Node DAG visualiser (replaces the VS Code graph panel)

### Bridge changes

- Remove `WORKSPACE_DIR` as an env-var boot parameter
- Accept `x-workspace` header or query param on every request
- Validate that the requested path is within an allowlist
- Bridge REST routes progressively absorbed into Next.js — bridge retains only MCP SSE

### Architecture note

Each workspace is a Gitea repo. The web app calls the Gitea API (`http://gitea:3000/api/v1`) to list repos, create repos, read commit history, and trigger push/pull. No separate database needed at this phase.

---

## Phase 3 — Multi-user Auth
*~6 weeks · Gitea OAuth, per-user workspaces · **✅ complete (2026-07-06)***

Different people log in with their own Gitea credentials and see only their repos as workspaces.

### Completed (2026-07-05)

- ✅ **Task 1 — Gitea OAuth app registration** — confidential client created in Gitea admin; `GITEA_CLIENT_ID` + `GITEA_CLIENT_SECRET` in `.env` and Docker compose environment
- ✅ **Task 2 — next-auth wiring** — `epoch-web/auth.ts`: custom Gitea OAuth provider; `jwt` + `session` callbacks thread `accessToken` and `login`; `authorized` callback blocks unauthenticated requests; `trustHost: true` for self-hosted; `NEXTAUTH_URL`, `NEXTAUTH_SECRET` in env; `epoch-web/middleware.ts` protects `/ws/:path*`; `epoch-web/components/AuthProvider.tsx` wraps layout; `WorkspaceHome` shows avatar + Sign Out from `useSession`/`signOut`
- ✅ **Task 3 — Thread OAuth token to bridge** — Next.js API proxy calls `auth()` server-side and injects `x-gitea-token: <Bearer>` + `x-gitea-user: <login>` headers; bridge Gitea helpers use Bearer auth when token is present; token never reaches the browser; `GITEA_URL` (browser-facing) vs `GITEA_INTERNAL_URL` (Docker server-side) split for OAuth redirect vs token exchange
- ✅ **Task 4 — Per-user workspace isolation** — bridge workspace middleware resolves `WORKSPACES_BASE_DIR/<user>/<wsName>` from `x-gitea-user` header; path-traversal guard against root base dir; `workspacesRouter(getBaseDir)` factory uses per-request dynamic resolution; user dirs created on demand; compile fix: removed `HOST_WORKSPACE_DIR` env override in `compileFragment` (bridge always runs on host; old override caused Docker volume mismatch after isolation)

- ✅ **Task 5 — User settings page** — `/settings` page with Anthropic/OpenAI key inputs (AES-256-GCM encrypted at rest, keyed on `NEXTAUTH_SECRET`; keys masked in GET response, never sent to browser); vision provider dropdown persisted per user; `⚙` gear link in WorkspaceHome header; bridge `convert` route uses per-user key + provider pref when `x-gitea-user` is present, falls back to server env

- ✅ **Bridge allowlist** — workspace resolution middleware now requires `manifest.json` to exist at the resolved path before accepting it; path-traversal guard remains as a first layer

### Auth

- **Gitea OAuth 2.0** as identity provider — users already exist in the running Gitea instance
- `next-auth` with a Gitea OAuth provider (~50 lines of adapter code)
- OAuth token stored in session and used for all Gitea API calls on behalf of the user

### Workspace isolation

- Each user sees only repos owned by their Gitea account
- Workspace paths resolved under `WORKSPACES_BASE_DIR/<user>/` — per-user isolation at filesystem level
- Multiple users can collaborate on the same workspace by sharing a Gitea repo (both clone it; isolation is per login, not per repo)
- **Bridge allowlist** — replace the current "any valid dir name under base dir" policy with an explicit per-user allowlist of resolved paths; path-traversal guard already in place, this adds a positive-check layer

### Vision API keys

- Default: server-level key pool (current `.env` approach, shared)
- User settings page: override with own Anthropic/OpenAI key
- Keys stored encrypted server-side; never sent to the browser
- Provider selector configurable per workspace

### Key Decision — Why Gitea OAuth and not email/password

Gitea already manages user accounts, repo permissions, and git credentials. Using it as the OAuth provider means one identity system, not two. Users who have access to a repo in Gitea automatically have access in the web app — no separate permission sync.

---

## Phase 4 — Collaboration
*~10 weeks · shared editing, presence, review workflow*

Multiple users can edit the same workspace simultaneously. Conflicts are rare because nodes are independent files; git remains the persistent sync layer.

### Shared Monaco editing

- **Yjs** CRDT for shared document state
- **y-monaco** binding — live cursors, selections, and edits in the same `.tex` file
- **y-websocket** server (embedded in Next.js via `ws`, or as a small sidecar)
- Each node's `content.tex` is one Yjs document keyed by node path
- On disconnect: Yjs state flushed to disk and committed via git

### Shared canvas and presence

- Excalidraw's built-in multiplayer wired to the same y-websocket room
- Presence sidebar: avatars showing which node each user is currently viewing or editing
- Review workflow UI: `createReview` and `submitDecision` already exist in the backend — add browser forms
- Compile events broadcast to all session members over WebSocket
- Optional per-node pessimistic lock for sensitive nodes

---

## Phase 5 — Production
*Ongoing · HTTPS, rate limiting, admin tooling, backup*

Stable deployment for a team or public use.

### Networking

- nginx reverse proxy on 443 forwarding to Next.js, Gitea, Excalidraw, bridge
- Let's Encrypt via Certbot, or Caddy (auto-renews without cron)
- All backend services unreachable from the internet except through nginx
- WireGuard VPN option for private team deployments

### Rate limiting and ops

- Compile queue: max N concurrent pdflatex Docker containers
- Vision API: per-user daily quota enforced at the Next.js API layer
- Structured request logging to Postgres or SQLite
- Admin panel: user list, quotas, API key pool management, compile queue status

### Backup and export

- Workspace zip download — all nodes plus git history via `git bundle`
- Nightly Gitea data backup to object storage (S3, Backblaze B2)
- One-click restore from bundle file
- Outbound webhook on compile success (Slack, email)

---

## Infrastructure Evolution

### Now
```
vscode-ext ──→ bridge :3002 ──→ docker/pdflatex
                              └→ ollama :11434
gitea :3000
excalidraw :3001
```
Bridge holds `workspaceDir` as an env var at boot.

### Phase 1 — Add epoch-web
```
epoch-web :3003 ──→ bridge :3002
gitea :3000
excalidraw :3001
```
`epoch-web` calls the bridge REST API. VS Code extension continues to work in parallel.

### Phase 2–3 — Bridge slimmed to MCP only
```
epoch-web :3003 ──→ bridge :3002  (MCP SSE only)
                └──→ gitea :3000
excalidraw :3001
```
Bridge REST routes absorbed into Next.js API routes. Bridge retains only the MCP SSE endpoint used by Claude Code.

### Phase 4–5 — Collaboration + HTTPS
```
nginx :443 ──→ epoch-web :3003 ──→ bridge :3002
           ├──→ gitea :3000       y-ws :3004
           └──→ excalidraw :3001
```
Yjs WebSocket server added. All services sit behind nginx with TLS.
