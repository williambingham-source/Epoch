# Epoch — Project Plan

## What is Epoch?

A local research platform built in VS Code. Research is organized as a Fractal
Workspace — a Git repository where every claim is a folder (a "node"), each with
an epistemic status (Sketch → Conjecture → Hypothesis → Theorem). Nodes link to
sub-nodes, forming a DAG of claims that can be compiled into a single PDF. The
primary UI is a VS Code Webview; the same core logic is accessible from the
terminal via Node.js scripts.

---

## Architecture Decisions

### UI — Hybrid Webview
- **Primary surface**: VS Code Webview (React or Svelte) living inside the editor.
- **Fallback surface**: Node.js CLI scripts for quick terminal operations.
- Core logic lives in `src/core/` and `src/tools/` — both surfaces call the same
  functions; only the entry point differs.

### DAG Visualization
- **Don't** render a global graph (spaghetti risk).
- **Do** use a Breadcrumb-Hierarchy view (current node + ancestors) paired with a
  Dependency Graph Sidebar (immediate children only).
- Clicking a node in the sidebar opens its folder in the VS Code Explorer.
- Drag-and-drop in the Webview re-parents nodes (moves folders on disk + Git commit).

### Disk Structure — Fractal Workspace
Every workspace is a single Git repository. Layout:

```
/workspace-root/
  manifest.json          ← master index: maps the entire research tree
  /Node_A/
    node.json            ← local metadata: status, dependencies, title
    content.tex          ← main LaTeX body for this node
    /data/               ← assets, CSVs, figures
  /Node_B/
    node.json
    content.tex
    /Node_B1/            ← sub-nodes nest inside parent folders
      node.json
      content.tex
```

**Schema split (replaces single `project.json`):**
- `manifest.json` — workspace-level: name, id, root node path, author, createdAt
- `node.json` — per-node: id, title, status, validationPath (relative paths to
  child node.json files), updatedAt, tags

### Sync — Distributed Git
- **Backup / collaboration hub**: standard Git remote (GitHub, GitLab, or
  self-hosted Gitea). Push/pull is the offline sync layer.
- **Real-time (future)**: Yjs + WebRTC provider — peer-to-peer live sync with no
  central server required. Falls back to Git when peers are offline.

### Multi-User / Review
- Status changes trigger a Git PR automatically.
- Collaborators review via PR comments (code/proof review maps naturally to diff review).
- Merging the PR is the act of promoting a node to Theorem.
- No proprietary review system needed — Git Issues and PRs carry the workflow.

---

## Phase 1 — The Foundation ✅

- `src/types/project.ts` — Project schema, `ProjectStatus` enum, type guard
- `src/core/repository.ts` — Browser-safe Git storage (isomorphic-git + LightningFS)
- `src/core/repository-node.ts` — Node.js Git storage (isomorphic-git + native fs)
- `src/tools/latex-compiler.ts` — DAG walk + pdflatex via Docker
- `src/index.ts` — Barrel exports (browser-safe only)
- `src/mcp/server.ts` — MCP server (stdio) exposing 5 tools to Claude Code
- `.mcp.json` — MCP server wired into VS Code

**MCP tools available:**
`init_project` · `read_project` · `write_project` · `get_history` · `compile_project`

---

## Phase 2 — Fractal Workspace Schema ✅

Migrate from a single `project.json` per repo to the Fractal Workspace layout.

**Deliverables:**
- [x] `src/types/manifest.ts` — `Manifest` interface + type guard
- [x] `src/types/node.ts` — `ResearchNode` interface + type guard (replaces `Project`)
- [x] `src/core/workspace.ts` — Node.js functions:
  - `initWorkspace(dir, name, author)` → writes `manifest.json`, first Git commit
  - `addNode(workspaceDir, parentPath, title)` → creates node folder + `node.json`
  - `moveNode(workspaceDir, fromPath, toPath)` → renames folder + Git commit
  - `readNode(nodePath)` → parses `node.json`
  - `writeNode(nodePath, node, commitMessage?)` → writes + commits
  - `readManifest(workspaceDir)` → parses `manifest.json`
  - `listNodes(workspaceDir)` → walks all `node.json` files, returns flat list
- [x] `src/tools/dag.ts` — DAG traversal helpers (topological sort, cycle detection,
  path-to-root)
- [x] Update MCP server with new tools:
  - `init_workspace` · `add_node` · `move_node` · `read_node` · `write_node`
  - `list_nodes` · `get_workspace_history`
- [x] Update LaTeX compiler to walk `node.json` `validationPath` instead of `project.json`

---

## Phase 3 — VS Code Webview ✅

Build the primary UI as a VS Code extension with a Webview panel.

**Deliverables:**
- [x] `src/extension/` — VS Code extension entry point (`extension.ts`)
  - Registers `epoch.openWorkspace` command
  - Opens a Webview panel
  - Handles message passing between Webview ↔ extension host
- [x] `src/webview/` — React app bundled separately (Vite)
  - **Breadcrumb bar** — current node path, clickable ancestors
  - **Node editor** — title, status dropdown, description, tags, validation path
  - **Children sidebar** — immediate children rendered as cards; click to navigate, add new
  - **Compile panel** — compiles workspace to PDF via Docker/pdflatex, shows result
  - **PDF viewer** — renders compiled PDF in-webview via pdf.js (lazy-loaded)
- [x] `package.json` additions — `vscode` engine, `activationEvents`, `contributes`
- [x] `vite.config.ts` — bundles the Webview app into `dist/webview/`
- [x] Extension build pipeline (tsc for extension host, Vite for webview)

**Sample workspace:** `three-distance/` — six-node workspace on the Three-Distance
Theorem (Steinhaus 1958), compiles to a 6-page PDF covering history, statement,
proof, continued fractions, and examples.

---

## Local Gitea Server

A self-hosted Gitea instance runs in Docker for local git sync and (eventually)
PR-based review. Start/stop with `docker compose` from the `gitea/` directory.

| Item         | Value                                    |
|--------------|------------------------------------------|
| Web UI       | http://localhost:3000                    |
| Username     | `william`                                |
| Password     | `epoch-local`                            |
| Repo URL     | http://localhost:3000/william/epoch      |
| Git remote   | http://william:epoch-local@localhost:3000/william/epoch.git |

```bash
# Start
docker compose -f gitea/docker-compose.yml up -d

# Stop (data is preserved in gitea/data/)
docker compose -f gitea/docker-compose.yml down

# Push changes
git push origin master
```

---

## Phase 4 — Sync & Collaboration ✅ (partial)

Add Git remote sync and lay groundwork for real-time collaboration.

**Deliverables:**
- [x] `src/core/sync.ts` — system-git push/pull via child_process; Windows-safe
  git binary resolution; `getRemoteInfo` (branch, ahead/behind, last commit)
- [x] Webview "Sync" panel — compact status bar showing branch, ↑/↓ counts,
  clickable remote URL, Push / Pull / Refresh buttons, last-action result
- [x] MCP tools: `push_workspace` · `pull_workspace` · `get_remote_info`
- [x] `src/core/workspace.ts` — isomorphic-git commits made best-effort so
  node saves succeed when workspace lives inside a parent git repo
- [x] `src/types/review.ts` + `src/core/reviews.ts` — in-app review system
  (createReview, listReviews, submitDecision — stored as `reviews/*.json` in git)
- [x] `ReviewsPanel` sidebar section, `ReviewView` full-screen reviewer UI
- [x] NodeEditor inline request form + status banners
- [x] MCP tools: `create_review` · `list_reviews` · `submit_decision`
- [x] Gitea PR-based review (`src/tools/review.ts`) removed — see `plan/pr.md`
- [ ] Yjs integration scaffold — deferred

---

## Phase 5 — Mobile / Tablet UI via Excalidraw (planned)

Provide a touch-first canvas interface for navigating and annotating the Fractal
Workspace — ideal for iPad or Android tablet use during seminars or away from a
keyboard.

### Architecture

The Epoch-Excalidraw integration runs as a **separate Docker service** alongside
Gitea. It serves a customised build of Excalidraw on **port 3001**. Epoch nodes
are represented as Excalidraw elements; edits sync back to the workspace via the
MCP server (create/update/move nodes without touching a keyboard).

### Repo

- GitHub upstream: `https://github.com/excalidraw/excalidraw` (remote `upstream`)
- Local Gitea fork: `http://localhost:3000/william/excalidraw` (remote `origin`)
- Local path: `C:\Users\The Binghams\OneDrive\Desktop\Excalidraw`

### Deliverables

- [x] Shallow-clone upstream → Desktop/Excalidraw, remote `upstream`
- [x] Unshallow and push full history to Gitea `william/excalidraw` (remote `origin`)
- [x] `docker-compose.epoch.yml` — `epoch-excalidraw` container, port 3001, production build
- [ ] Epoch-specific Excalidraw scene schema: each node ↔ one Excalidraw frame
- [ ] Custom sidebar panel: node metadata (status, title, dependencies) visible in canvas
- [ ] Epoch API bridge: thin HTTP server wrapping the MCP tools so Excalidraw can
  read/write nodes without a VS Code extension host
- [ ] Deep-link from Epoch VS Code panel → open node in Excalidraw canvas
- [ ] Two-way sync: canvas drag-to-reorder re-parents nodes in the workspace

### Starting the Excalidraw service

```bash
# First build takes ~5 min (downloads node_modules, compiles React app)
docker compose -f "C:\Users\The Binghams\OneDrive\Desktop\Excalidraw\docker-compose.epoch.yml" up -d --build
# Serves at http://localhost:3001
```

---

## Phase 6 — User State & Security (planned)

Add multi-user identity, persistent session state, and access controls so that
workspaces can be shared with meaningful trust boundaries.

**Deliverables (TBD):**
- [ ] **User identity** — named user profiles stored in `~/.epoch/identity.json`
  (name, email, optional key pair). Used to sign review decisions and commits.
- [ ] **Workspace access roles** — `manifest.json` gains an `access` field:
  `owner`, `reviewer`, `reader`. Enforced by the extension host before any write.
- [ ] **Signed review decisions** — `ReviewDecision` includes a detached signature
  over `{reviewId, verdict, at}` using the reviewer's identity key, so approvals
  cannot be forged by editing the JSON.
- [ ] **Auth for Gitea push/pull** — credentials stored in the OS keychain
  (VS Code `SecretStorage`) rather than embedded in the remote URL.
- [ ] **Audit log** — append-only `audit.log` in the workspace root, recording
  every status change and review decision with timestamp and identity.
- [ ] **Read-only mode** — when the current user has `reader` role, all save/add/
  review-request actions are disabled in the UI with a clear explanation.

---

## Next Steps / Housekeeping

- **Move repos off OneDrive** — relocate `Epoch` and `Excalidraw` from
  `OneDrive\Desktop\` to a local path (e.g. `C:\Dev\`) to avoid OneDrive
  sync conflicts with `.git` directories, large `node_modules`, and Docker
  volume mounts. Update any hardcoded paths in `plan.md`, `gitea/`, and the
  Excalidraw `docker-compose.epoch.yml`.

---

## Deferred / Out of Scope for Now

- Yjs real-time live sync (Phase 4 scaffold only)
- Self-hosted Gitea setup guide
- Export formats beyond PDF (HTML, EPUB)
