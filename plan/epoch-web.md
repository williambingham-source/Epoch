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

**Not yet built from original Phase 1 scope:**
- ✅ Git log view (read-only commit history panel) — shipped 2026-07-05
- ❌ validationPath / DAG dependency UI

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
- ❌ validationPath / DAG dependency UI — deferred to next iteration

### Not in Phase 1

Authentication, multiple workspaces, real-time collaboration, Gitea integration.

### Key Decision — Next.js over plain Vite + Express

Next.js API routes proxy to the bridge rather than importing `workspace.ts` directly. The bridge stays on port 3002 for MCP/Excalidraw. Its REST routes are gradually absorbed into Next.js in Phase 2, leaving the bridge to serve only the MCP SSE endpoint.

---

## Phase 2 — Multi-workspace
*~5 weeks · workspace picker, Gitea API*

A home screen lists and creates workspaces backed by Gitea repos. The bridge becomes stateless — workspace path is passed per request rather than baked in at startup.

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
*~6 weeks · Gitea OAuth, per-user workspaces*

Different people log in with their own Gitea credentials and see only their repos as workspaces.

### Auth

- **Gitea OAuth 2.0** as identity provider — users already exist in the running Gitea instance
- `next-auth` with a Gitea OAuth provider (~50 lines of adapter code)
- OAuth token stored in session and used for all Gitea API calls on behalf of the user

### Workspace isolation

- Each user sees only repos owned by their Gitea account
- Workspace paths resolved from Gitea clone URLs, not raw filesystem paths
- Server clones repos to a per-user working directory on first access; periodic `git pull` keeps it fresh

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
