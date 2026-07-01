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

## Phase 4 — Sync & Collaboration

Add Git remote sync and lay groundwork for real-time collaboration.

**Deliverables:**
- [ ] `src/core/sync.ts` — wraps isomorphic-git push/pull/fetch with auth helpers
  - Supports GitHub token, SSH key (via http plugin), and unauthenticated Gitea
- [ ] Webview "Sync" panel — remote URL config, push/pull status, conflict summary
- [ ] `src/tools/review.ts` — GitHub/Gitea API client:
  - `openReviewRequest(node, fromStatus, toStatus)` → creates a PR
  - `mergeReview(prId)` → merges PR, promotes node to Theorem locally
- [ ] Yjs integration scaffold (`src/core/realtime.ts`) — provider setup, awareness
  cursors, deferred until a collaborator is online
- [ ] MCP tools: `push_workspace` · `pull_workspace` · `open_review` · `merge_review`

---

## Deferred / Out of Scope for Now

- Yjs real-time live sync (Phase 4 scaffold only)
- Self-hosted Gitea setup guide
- Mobile / tablet UI
- Export formats beyond PDF (HTML, EPUB)
