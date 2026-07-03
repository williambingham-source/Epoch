# Epoch

A local research platform built as a VS Code extension. Epoch organises mathematical
and scientific work as a **Fractal Workspace** — a Git repository where every claim
is a folder (a *node*), each carrying an epistemic status that advances from
**Sketch → Conjecture → Hypothesis → Theorem** through a structured peer-review
process. Nodes link to one another, forming a dependency graph that compiles into
a single PDF via LaTeX.

---

## What Epoch Is For

Epoch is designed for researchers who want to:

- **Manage a growing body of formal claims** without losing track of what has and
  hasn't been rigorously established.
- **Write in LaTeX** and see the compiled output without leaving VS Code.
- **Collaborate through peer review** — a colleague can pull your workspace, review
  your LaTeX in context, and approve or request changes, all inside the same UI.
- **Keep everything in Git** — no proprietary database, no cloud lock-in. Every
  save, every review decision, every status change is a commit.
- **Use Claude as a research assistant** via an MCP server that exposes every
  workspace operation as a tool Claude can call.

---

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | 18 | For building the extension |
| [VS Code](https://code.visualstudio.com) | 1.90 | The host for the extension |
| [Git](https://git-scm.com) | Any recent | Must be in PATH or installed at `C:\Program Files\Git` on Windows |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Any recent | Required only for PDF compilation |

An internet connection is needed only once — when Docker pulls `texlive/texlive:latest`
on the first compile.

---

## Installation

### 1. Clone and build

```bash
git clone <repo-url> epoch
cd epoch
npm install
npm run build
```

This compiles the TypeScript extension host (`dist/`) and bundles the React webview
(`dist/webview/`).

### 2. Load the extension in VS Code

Epoch is not yet published to the VS Code Marketplace, so it must be loaded as a
development extension.

1. Open the `epoch` folder in VS Code (`File → Open Folder`).
2. Press `F5` (or **Run → Start Debugging**).
3. A new VS Code window opens with the extension active. All subsequent steps
   happen in that window.

> **Tip:** After any code change, run `npm run build` and reload the extension
> window with **Developer: Reload Window** (`Ctrl+Shift+P`).

---

## Opening a Workspace

An Epoch workspace is an ordinary Git repository with a `manifest.json` at its root.

### Use the included example

The `three-distance/` folder in this repository is a ready-made workspace covering
the Three-Distance Theorem. Open it:

1. In the extension window, press `Ctrl+Shift+P` and run **Epoch: Open Workspace**.
2. If `three-distance/` is inside the currently open VS Code folder, Epoch detects
   `manifest.json` automatically.
3. Otherwise, choose **Open existing workspace** and navigate to `three-distance/`.

### Create a new workspace

1. Open an empty folder in VS Code.
2. Press `Ctrl+Shift+P` → **Epoch: Open Workspace**.
3. Choose **Initialize new workspace here**.
4. Enter a workspace name, your name, and your email.

Epoch writes `manifest.json` and makes the first Git commit.

---

## The Epoch UI

The Epoch panel has four main areas:

```
┌─────────────────────────────────────────────────────────────┐
│  Breadcrumb bar           Three-Distance Problem > Proof    │
├─────────────────────────────────┬───────────────────────────┤
│                                 │  Nodes                    │
│  Main content area              │  ──────────────────────   │
│  (Node editor / PDF /           │  • Introduction           │
│   Review view)                  │  • Theorem Statement      │
│                                 │  • Proof            ←here │
│                                 │  • Continued Fractions    │
│                                 │  ──────────────────────   │
│                                 │  Reviews (1)              │
│                                 │  ⏳ 2+2=4  Hyp → Thm    │
├─────────────────────────────────┴───────────────────────────┤
│  ⬡ Compile Workspace    ✓ PDF compiled                      │
│  ⎇ master  ✓  localhost:3000/…  Push  Pull  ↺               │
└─────────────────────────────────────────────────────────────┘
```

### Breadcrumb bar
Shows the path from the workspace root to the current node. Click any ancestor
to navigate up.

### Main content area
Switches between three modes:
- **Node editor** — edit a node's title, status, description, tags, and validation path.
- **PDF viewer** — the compiled workspace PDF rendered in-browser via pdf.js.
- **Review view** — the full peer-review experience (see below).

### Sidebar
- **Nodes** — immediate children of the current node. Click to navigate, click
  **+** to add a child node.
- **Reviews** — pending and resolved review requests. A badge shows how many
  reviews are waiting for action.

### Compile bar
- **⬡ Compile Workspace** — runs pdflatex inside Docker and renders the result.
- **⊞ View PDF / ✎ Edit** — toggles between the PDF viewer and the node editor
  once a PDF has been compiled.

### Sync bar
Shows the current Git branch, how many commits you are ahead/behind the remote,
and **Push** / **Pull** / **↺** buttons for syncing with the remote.

---

## Nodes and Epistemic Status

Every claim in Epoch lives in its own folder. The folder contains:

```
my-claim/
  node.json        ← metadata: title, status, description, dependencies
  content.tex      ← the LaTeX source for this claim
  data/            ← figures, CSVs, any supporting files
```

Nodes are nested to express logical structure:

```
workspace-root/
  introduction/
  theorem-statement/
  proof/
    lemma-a/
    lemma-b/
  continued-fractions/
```

### The four statuses

| Status | Meaning |
|---|---|
| **Sketch** | A rough idea or explanatory note — not a formal claim. No review required. |
| **Conjecture** | A formal claim you believe is true but haven't proved. |
| **Hypothesis** | A claim supported by evidence or partial argument. |
| **Theorem** | A fully proved claim, approved by a peer reviewer. |

Statuses only move upward through peer review. You can always demote a node
manually by editing it directly.

### Editing a node

1. Click a node in the sidebar to open it.
2. Edit the **Title**, **Status**, **Description**, or **Tags** fields.
3. Under **Validation Path**, add dependencies on other nodes — this is how you
   declare "this theorem relies on these lemmas".
4. Click **Save**.

Saving writes `node.json` to disk and creates a Git commit.

---

## Writing LaTeX

Each node's mathematical content lives in `content.tex`. Epoch does not provide
an in-app LaTeX editor — use the VS Code text editor directly.

1. Click **⇱ Folder** in the node editor to reveal the node's folder in the
   VS Code Explorer.
2. Open `content.tex` and write your LaTeX.
3. Use standard LaTeX commands. The master preamble already loads:
   `mathtools`, `amssymb`, `amsthm`, `geometry`, `hyperref`, and the standard
   theorem environments (`theorem`, `lemma`, `corollary`, `definition`, `remark`).
4. Do **not** include `\documentclass` or `\begin{document}` — those are
   generated automatically by Epoch's compiler.

---

## Compiling to PDF

Click **⬡ Compile Workspace** in the compile bar.

Epoch:
1. Walks all nodes in topological order (dependencies before dependents).
2. Generates a master `.tex` file that `\input{}`s each `content.tex`.
3. Runs `pdflatex` twice inside the `texlive/texlive:latest` Docker container
   (no local TeX installation required).
4. Renders the resulting PDF in the webview via pdf.js.

If the compile fails, the status bar shows the first LaTeX error line. Hover
over it for the full error message.

**Switching between PDF and editor:** Use the **⊞ View PDF** / **✎ Edit** toggle
button that appears after a successful compile.

---

## Peer Review

When you want to promote a node to a higher status, you request a peer review
instead of changing the status yourself.

### Requesting a review (author)

1. Open the node you want to promote.
2. Change the **Status** dropdown to the target status (e.g. Hypothesis → Theorem).
3. A **↗ Request Review (→ Theorem)** button appears.
4. Click it — an inline form opens asking for an optional cover note to the reviewer.
5. Click **↗ Submit Request**.

Epoch creates a `reviews/{id}.json` file, commits it, and pushes to the remote
so your collaborator can pull it. The node's status in `node.json` **does not
change yet** — it only changes when the review is approved.

A yellow **⏳ Review pending** banner appears on the node. Click it to open the
review in the Review view.

### Reviewing (reviewer)

1. Pull the workspace (**Pull** in the sync bar).
2. The **Reviews** section in the sidebar shows a badge: **Reviews (1)**.
3. Click the pending review card.
4. The **Review view** opens:
   - **Left panel** — node metadata, the author's cover note, and the validation
     path of dependencies.
   - **Right panel** — the exact `content.tex` snapshot that was submitted for
     review (read-only).
   - **⊞ View in PDF** button — compiles the whole workspace and switches to the
     PDF viewer so you can read the typeset mathematics.
5. Enter a comment (required for "Request Changes", optional for "Approve").
6. Click **✓ Approve** or **✗ Request Changes**.

On approval, Epoch immediately writes the new status to `node.json`, commits
both files, and pushes. The author sees the updated status after their next pull.

### Review history

Resolved reviews stay in the **Reviews** sidebar (greyed out) so you can always
go back and read the approval or rejection comment.

---

## Git Sync

Epoch uses ordinary Git push/pull for collaboration. The **sync bar** at the
bottom of the panel shows:

- `⎇ master` — current branch
- `↑2 ↓1` — commits ahead / behind the remote (or `✓` if in sync)
- The remote URL (click to open in the browser)
- **Push**, **Pull**, **↺** buttons

### Setting up a remote

Add any Git remote to the workspace repo:

```bash
# Inside the workspace directory (e.g. three-distance/)
git remote add origin https://github.com/you/my-workspace.git
git push -u origin master
```

Epoch picks up the remote automatically on next refresh.

### Local Gitea (optional)

For fully offline collaboration, a self-hosted [Gitea](https://gitea.io) instance
is included. Start it with:

```bash
docker compose -f gitea/docker-compose.yml up -d
```

| Item | Value |
|---|---|
| Web UI | http://localhost:3000 |
| Default user | `william` |
| Default password | `epoch-local` |

Create a repository in Gitea, then:

```bash
git remote add origin http://william:epoch-local@localhost:3000/william/my-workspace.git
git push -u origin master
```

Stop with `docker compose -f gitea/docker-compose.yml down`. Data is preserved
in `gitea/data/`.

---

## MCP Integration (Claude)

Epoch ships an [MCP](https://modelcontextprotocol.io) server that exposes every
workspace operation as a tool Claude Code can call. This means you can ask
Claude to add nodes, write LaTeX, compile, request reviews, and more — all from
a conversation.

### Enabling the MCP server

The server is pre-configured in `.mcp.json` at the project root. Claude Code
picks it up automatically when you open the `epoch` project directory.

### Available MCP tools

| Tool | What it does |
|---|---|
| `init_workspace` | Create a new Epoch workspace |
| `add_node` | Add a node (folder + node.json + content.tex) |
| `read_node` / `write_node` | Read or update a node's metadata |
| `move_node` | Rename / re-parent a node |
| `list_nodes` | List all nodes with paths and statuses |
| `read_manifest` | Read the workspace manifest |
| `get_workspace_history` | Full Git log |
| `compile_workspace` | Compile all nodes to PDF via Docker |
| `push_workspace` | Commit pending changes and push to remote |
| `pull_workspace` | Pull latest commits from remote |
| `get_remote_info` | Branch, ahead/behind counts, remote URL |
| `create_review` | Submit a peer-review request for a node |
| `list_reviews` | List all review requests in the workspace |
| `submit_decision` | Approve or request changes on a review |

### Example prompts

```
Add a node called "Completeness of ℝ" as a child of "foundations", at Conjecture status.

Compile the workspace and tell me if there are any LaTeX errors.

List all nodes that are currently at Hypothesis status.

Submit a review request for the "Archimedean Property" node, proposing Theorem status.
The cover note is: "Proof is complete — please check the epsilon argument in lemma 3."
```

---

## Project Structure

```
epoch/
├── src/
│   ├── core/                  # Node.js-only business logic
│   │   ├── workspace.ts       # Node CRUD + Git commits
│   │   ├── reviews.ts         # Peer review (create, list, decide)
│   │   ├── sync.ts            # Git push/pull, remote info
│   │   └── _git.ts            # Windows-safe git binary helpers
│   ├── extension/
│   │   └── extension.ts       # VS Code extension entry point
│   ├── mcp/
│   │   └── server.ts          # MCP server (stdio)
│   ├── tools/
│   │   ├── latex-compiler.ts  # Docker/pdflatex compiler
│   │   └── dag.ts             # Topological sort, cycle detection
│   ├── types/
│   │   ├── project.ts         # ProjectStatus enum
│   │   ├── node.ts            # ResearchNode schema + type guard
│   │   ├── manifest.ts        # Manifest schema + type guard
│   │   └── review.ts          # ReviewRequest schema + type guard
│   └── webview/               # React app (bundled by Vite)
│       ├── App.tsx
│       ├── types.ts           # Shared message-protocol types
│       ├── index.css
│       └── components/
│           ├── BreadcrumbBar.tsx
│           ├── NodeEditor.tsx
│           ├── ChildList.tsx
│           ├── CompilePanel.tsx
│           ├── PdfViewer.tsx
│           ├── SyncPanel.tsx
│           ├── ReviewsPanel.tsx
│           └── ReviewView.tsx
├── three-distance/            # Example workspace
│   ├── manifest.json
│   ├── introduction/
│   ├── theorem-statement/
│   ├── proof/
│   ├── continued-fractions/
│   ├── examples/
│   └── 2-2-4/
├── gitea/
│   └── docker-compose.yml     # Local Gitea server
├── plan/
│   ├── plan.md                # Project roadmap
│   └── pr.md                  # In-app review system design
└── .mcp.json                  # MCP server config for Claude Code
```

---

## The Three-Distance Example Workspace

The `three-distance/` folder is a worked example covering the Three-Distance
Theorem (Steinhaus 1958): *for any irrational α and any n, the points
{α}, {2α}, …, {nα} on the unit circle create at most three distinct gap lengths.*

| Node | Status | Content |
|---|---|---|
| `introduction/` | Sketch | Historical context and motivation |
| `theorem-statement/` | Hypothesis | Formal statement of the theorem |
| `proof/` | Hypothesis | Main proof via continued fractions |
| `continued-fractions/` | Hypothesis | Background on continued fraction expansions |
| `examples/` | Sketch | Concrete numerical examples |
| `2-2-4/` | Hypothesis | Peano axiom derivation of 2 + 2 = 4 |

Compiling the workspace produces a 7-page PDF. Use it to explore all the UI
features before starting your own research.

---

## Keyboard Reference

| Action | How |
|---|---|
| Open Epoch panel | `Ctrl+Shift+P` → **Epoch: Open Workspace** |
| Save node | Click **Save** (node editor) |
| Compile | Click **⬡ Compile Workspace** |
| Toggle PDF / editor | Click **⊞ View PDF** / **✎ Edit** |
| Navigate up | Click workspace name or ancestor in breadcrumb |
| Open node folder | Click **⇱ Folder** in the node editor |
| Push / Pull | Click **Push** / **Pull** in the sync bar |

---

## Roadmap

See [plan/plan.md](plan/plan.md) for the full roadmap. Upcoming work includes:

- **Phase 5** — In-app peer review UI (in progress)
- **Phase 6** — User identity, workspace access roles, signed review decisions,
  OS keychain credential storage, audit log
- Real-time collaboration via Yjs + WebRTC (deferred)
- Export formats beyond PDF

---

## License

MIT
