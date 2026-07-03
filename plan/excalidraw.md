# Epoch × Excalidraw — Design Document

## Overview

Excalidraw becomes a **two-way interface** between ink and formal mathematics.
The canvas is the scratchpad; Epoch is the theorem ledger. A bridge service
running alongside the Excalidraw app connects the two, using a vision-capable
LLM to lift handwritten or drawn content into LaTeX and compiling it for
preview before any node is created or modified.

The bridge is **AI-agnostic** — the vision conversion step is behind a
`VisionProvider` interface, so any model (Anthropic, OpenAI, Gemini, Ollama)
can be swapped in via environment variable without changing application code.

The bridge also runs as an **MCP server** alongside its REST API, so Claude
Code (or any MCP client) can orchestrate the same operations from a
conversation — draw → convert → compile → review → commit — without touching
the canvas UI.

---

## The Two Workflows

### Flow A — Ink → Node (Capture)

A user sketches a proof step, a diagram, or a formula on the canvas. They want
it to become a node in the Epoch workspace.

```
┌─────────────────────────────────────────────────────────────┐
│  Excalidraw canvas                                          │
│                                                             │
│  ✏ [user draws / writes]                                   │
│                                                             │
│  [Select region]  →  "Convert to LaTeX"                     │
│          │                                                  │
│          ▼                                                  │
│  Bridge: PNG → VisionProvider → LaTeX string               │
│          │                                                  │
│          ▼                                                  │
│  Bridge: LaTeX → pdflatex (Docker) → PDF bytes             │
│          │                                                  │
│          ▼                                                  │
│  Excalidraw overlay: PDF preview beside the ink            │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │  ✓ Accept            │  │  ✗ Reject (back to ink)  │    │
│  └──────────────────────┘  └──────────────────────────┘    │
│          │                                                  │
│    (on Accept)                                              │
│          ▼                                                  │
│  "Create node" form: title, status, parent path            │
│          │                                                  │
│          ▼                                                  │
│  Bridge: add_node + write content.tex + git commit         │
│  Epoch panel refreshes; node appears in sidebar            │
└─────────────────────────────────────────────────────────────┘
```

**Key detail:** the ink elements are kept on a locked "source" layer even after
acceptance, so the user can always go back and see what was drawn. Only the
LaTeX version becomes canonical.

---

### Flow B — Node → Canvas (Review / Edit)

A user wants to review or revise an existing Epoch node without leaving the
tablet. They open the node in Excalidraw, annotate or rewrite sections in ink,
then save back.

```
┌─────────────────────────────────────────────────────────────┐
│  Epoch VS Code panel                                        │
│  [Node: "Archimedean Property"]  →  "⇱ Open in Canvas"     │
│          │                                                  │
│          ▼                                                  │
│  Deep-link opens http://localhost:3001?node=<path>         │
│          │                                                  │
│          ▼                                                  │
│  Excalidraw: loads node metadata + renders compiled PDF    │
│  into a locked "reference" frame on the canvas             │
│                                                             │
│  ✏ User annotates, strikes through, rewrites in ink        │
│                                                             │
│  "Save to node"                                            │
│          │                                                  │
│          ├── If ink-only edits: PNG → VisionProvider        │
│          │   → produces delta LaTeX string                 │
│          │   → user reviews diff before committing         │
│          │                                                  │
│          └── If text frame edits: raw text is the LaTeX   │
│                                                             │
│  Bridge: write_node (content.tex) + git commit             │
│  Option: "↗ Request Review" from the canvas               │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
                        ┌─────────────────────────────┐
                        │  Excalidraw React App        │
                        │  (nginx, port 3001)          │
                        │                              │
                        │  ┌────────────────────────┐ │
                        │  │  Epoch Sidebar plugin  │ │
                        │  │  - Node picker         │ │
                        │  │  - Convert button      │ │
                        │  │  - Accept / Reject     │ │
                        │  │  - Save to node        │ │
                        │  └────────────┬───────────┘ │
                        └──────────────┼──────────────┘
                                       │ HTTP REST
                        ┌──────────────▼──────────────┐
                        │  Epoch Bridge Service        │
                        │  (port 3002)                 │
                        │                              │
                        │  ┌──────────┐ ┌───────────┐ │
                        │  │ REST API │ │ MCP Server│ │
                        │  │ /api/*   │ │  (stdio / │ │
                        │  │          │ │   SSE)    │ │
                        │  └────┬─────┘ └─────┬─────┘ │
                        │       └──────┬───────┘       │
                        │         shared handlers       │
                        └──────────────┬───────────────┘
                                       │
               ┌───────────────────────┴──────────────────────┐
               │                                              │
   ┌───────────▼───────────┐                    ┌────────────▼────────────┐
   │  VisionProvider        │                   │  Epoch workspace.ts     │
   │  (interface)           │                   │  latex-compiler.ts      │
   │                        │                   │  reviews.ts             │
   │  AnthropicVision (def) │                   └─────────────────────────┘
   │  OpenAIVision          │
   │  GeminiVision          │
   │  OllamaVision          │
   └───────────────────────┘
```

The bridge is a **third Docker container** in the Epoch stack. It imports the
same `src/core/` and `src/tools/` modules as the VS Code extension — no
duplication of business logic. The REST API and MCP server share identical
handler functions; only the transport layer differs.

---

## VisionProvider Interface

```typescript
// bridge/vision/provider.ts

export interface ConvertResult {
  latex: string;
  confidence: 'high' | 'medium' | 'low';
  model: string;
}

export interface VisionProvider {
  name: string;
  convertImage(imageBase64: string, hint?: string): Promise<ConvertResult>;
}
```

### System prompt (shared across all providers)

```
You are a LaTeX transcription assistant for a mathematical research platform.

Given an image of handwritten or drawn mathematical content:
1. Return ONLY the LaTeX fragment — no \documentclass, no \begin{document}.
2. Use these environments where appropriate: theorem, lemma, corollary,
   definition, proof, remark (from amsthm).
3. Use mathtools and amssymb notation. \coloneqq is available.
4. If you cannot read a symbol clearly, write \textbf{??} in its place.
5. Preserve the logical structure of what was drawn (proof steps, cases, etc.).
6. Return nothing except the LaTeX.
```

### Built-in adapters

| Adapter | Env var | Model default |
|---|---|---|
| `AnthropicVisionProvider` | `VISION_PROVIDER=anthropic` | `claude-opus-4-8` |
| `OpenAIVisionProvider` | `VISION_PROVIDER=openai` | `gpt-4o` |
| `GeminiVisionProvider` | `VISION_PROVIDER=gemini` | `gemini-2.0-flash` |
| `OllamaVisionProvider` | `VISION_PROVIDER=ollama` | `llava` (local) |

`VISION_PROVIDER` defaults to `anthropic`. The specific model is overridable
via `VISION_MODEL` env var independently of the provider.

---

## MCP Server

The bridge exposes an MCP server on the same process as the REST API.
Transport: **stdio** (for Claude Code) and **SSE on `/mcp`** (for browser
clients or remote MCP hosts).

### MCP tools

| Tool | Description |
|---|---|
| `convert_ink` | Convert a base64 PNG of handwriting/diagrams to LaTeX |
| `compile_latex` | Compile a LaTeX fragment, return PDF as base64 |
| `list_nodes` | List all nodes in the active workspace |
| `get_node` | Get a node's metadata and content.tex |
| `create_node` | Create a new node with title, status, latex, optional ink PNG |
| `update_node` | Update an existing node's content.tex |
| `get_node_pdf` | Get the compiled PDF for a node (base64) |
| `open_in_canvas` | Generate the deep-link URL to open a node in Excalidraw |
| `get_vision_providers` | List available vision providers and the active one |

This MCP server is registered in `.mcp.json` alongside the existing Epoch MCP
server, so Claude Code can call canvas operations from any conversation.

### `.mcp.json` addition

```json
{
  "mcpServers": {
    "epoch": { "command": "node", "args": ["dist/mcp/server.js"] },
    "epoch-bridge": {
      "command": "node",
      "args": ["bridge/dist/server.js", "--mcp"],
      "env": {
        "WORKSPACE_DIR": "${workspaceFolder}/three-distance",
        "VISION_PROVIDER": "anthropic"
      }
    }
  }
}
```

---

## Bridge Service REST API

### `POST /api/convert`

Convert a PNG image of handwriting or a diagram to LaTeX.

**Request:**
```json
{
  "image": "<base64-encoded PNG>",
  "hint": "This is a proof step involving continued fractions"
}
```

**Response:**
```json
{
  "latex": "\\begin{proof}\n  Let $\\alpha$ be irrational...\n\\end{proof}",
  "confidence": "high",
  "model": "claude-opus-4-8",
  "provider": "anthropic"
}
```

---

### `POST /api/compile`

Compile a raw LaTeX fragment and return PDF bytes.

**Request:**
```json
{
  "latex": "\\begin{theorem}...\n\\end{theorem}"
}
```

**Response:** `Content-Type: application/pdf` — raw PDF bytes.

The bridge wraps the fragment in the same master preamble that `latex-compiler.ts`
uses, runs pdflatex in Docker, and streams the PDF back. Errors return
`{ "error": "! Undefined control sequence ..." }`.

---

### `GET /api/nodes`

Return all nodes in the active workspace (flat list).

**Response:**
```json
[
  { "path": "proof/lemma-a", "title": "Lemma A", "status": "Hypothesis" },
  ...
]
```

---

### `GET /api/nodes/:encodedPath`

Return a single node's metadata and `content.tex`.

**Response:**
```json
{
  "path": "proof/lemma-a",
  "node": { "title": "Lemma A", "status": "Hypothesis", ... },
  "latex": "\\begin{lemma}..."
}
```

---

### `POST /api/nodes`

Create a new node from accepted ink conversion (Flow A, accept step).

**Request:**
```json
{
  "parentPath": "proof",
  "title": "Lemma C",
  "status": "Conjecture",
  "latex": "\\begin{lemma}...",
  "inkPng": "<base64>"
}
```

The `inkPng` is stored in `data/source-ink.png` alongside `content.tex` as a
permanent record of what was drawn.

---

### `PUT /api/nodes/:encodedPath`

Update an existing node's `content.tex` (Flow B, save step).

**Request:**
```json
{
  "latex": "\\begin{lemma}...",
  "commitMessage": "revised via Excalidraw canvas"
}
```

---

### `GET /api/pdf/:encodedPath`

Return the compiled PDF for a specific node's current content (for the
reference frame in Flow B).

---

### `GET /api/providers`

Return the active vision provider and all available providers.

**Response:**
```json
{
  "active": "anthropic",
  "model": "claude-opus-4-8",
  "available": ["anthropic", "openai", "gemini", "ollama"]
}
```

---

## Epoch Webview Integration

The canvas is available in two modes from within VS Code — embedded in the
Epoch panel and popped out into a standalone window — without requiring the
user to leave the editor.

### Content area modes

Epoch's main content area already switches between three modes (node editor,
PDF viewer, review view). The canvas becomes a **fourth mode**: `showCanvas`.

```
┌─────────────────────────────────────────────────────────────┐
│  Breadcrumb bar                                             │
├─────────────────────────────┬───────────────────────────────┤
│                             │  Nodes                        │
│  ┌─────────────────────┐   │  ──────────────────────────   │
│  │                     │   │  • Introduction               │
│  │  Excalidraw canvas  │   │  • Theorem Statement          │
│  │  (iframe)           │   │  • Proof             ←here    │
│  │                     │   │  ──────────────────────────   │
│  └─────────────────────┘   │  Reviews (1)                  │
│                             │                               │
├─────────────────────────────┴───────────────────────────────┤
│  ⬡ Compile   ✎ Edit   ⊞ PDF   ✏ Canvas   ⇱ Pop out        │
│  ⎇ master  ✓  localhost:3000/…  Push  Pull  ↺              │
└─────────────────────────────────────────────────────────────┘
```

- **✏ Canvas** button in the compile bar switches to `showCanvas` mode.
- The iframe loads `http://localhost:3001?node=<currentNodePath>` so the
  canvas opens directly on the active node.
- **⇱ Pop out** sends a message to the extension host, which calls
  `vscode.env.openExternal(Uri.parse('http://localhost:3001?node=<path>'))` —
  opening the canvas in the system browser at full screen (ideal for tablet).

### VS Code webview CSP

VS Code webviews have a restrictive Content Security Policy by default.
The extension's `getHtmlForWebview()` must explicitly allow the iframe:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           script-src ${webview.cspSource} 'unsafe-inline';
           style-src ${webview.cspSource} 'unsafe-inline';
           img-src ${webview.cspSource} data: blob:;
           frame-src http://localhost:3001;
           connect-src http://localhost:3002 http://localhost:3000;" />
```

`frame-src http://localhost:3001` is the key addition — without it the iframe
is blocked silently.

### Communication between iframe and Epoch sidebar

The Excalidraw iframe and the Epoch React app cannot share state directly
(cross-origin iframe). Two lightweight mechanisms bridge them:

| Direction | Mechanism |
|---|---|
| Epoch → Canvas | URL params on iframe `src`: `?node=<path>&action=open` |
| Canvas → Epoch | `window.postMessage` from iframe; Epoch listens for `epochCanvasEvent` messages |

`epochCanvasEvent` payload examples:

```json
{ "type": "nodeCreated", "path": "proof/lemma-c" }
{ "type": "nodeSaved",   "path": "proof/lemma-a" }
{ "type": "popout" }
```

When Epoch receives `nodeCreated` or `nodeSaved` it refreshes the node list
(same path as after a pull). When it receives `popout` it calls
`vscode.env.openExternal`.

### Standalone window (popped out or remote machine)

When opened in a system browser — whether on the same machine or on a tablet
or laptop across the network — the Excalidraw app functions identically. It
derives the bridge address at runtime from the hostname it was loaded from:

```typescript
// excalidraw-app/src/epoch/config.ts
export const BRIDGE_URL = `http://${window.location.hostname}:3002`;
```

This means a tablet hitting `http://192.168.1.100:3001` automatically resolves
the bridge as `http://192.168.1.100:3002` — no per-client configuration needed.

The Epoch panel no longer tracks canvas state in real time once the canvas is
accessed externally, but the next Pull or node-list refresh picks up any
commits the canvas made via the bridge.

### Network requirements for remote access

| Requirement | Detail |
|---|---|
| Bridge binds to `0.0.0.0` | Must not restrict to `127.0.0.1`; Docker default is correct |
| CORS on bridge | Allow all origins (`*`) or the LAN subnet — not just `localhost` |
| Windows Firewall | Inbound rules for TCP 3001 and 3002 on the LAN interface |
| LAN / Tailscale | Same network or a Tailscale tunnel for cross-network access |

For Windows Firewall, add rules once:
```powershell
New-NetFirewallRule -DisplayName "Epoch Excalidraw" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
New-NetFirewallRule -DisplayName "Epoch Bridge"      -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow
```

For access outside the LAN (e.g. from an iPad on cellular), install
[Tailscale](https://tailscale.com) on both machines. The Excalidraw URL
becomes `http://<tailscale-ip>:3001` and `window.location.hostname` resolves
the bridge correctly with no further changes.

---

## Excalidraw Customisation

All customisation lives inside the Excalidraw fork at
`excalidraw-app/src/epoch/`. The upstream files are not modified — the Epoch
panel is injected via the app's existing plugin/sidebar hook points.

### `epoch/EpochSidebar.tsx`

A sidebar panel added to the Excalidraw UI:

```
┌──────────────────────────┐
│  EPOCH                   │
│  Workspace: three-distance│
│  ──────────────────────  │
│  [Convert selection →]   │
│  ──────────────────────  │
│  Nodes                   │
│  • Introduction    Sketch │
│  • Theorem Stmt    Hyp   │
│  • Proof           Hyp ← │
│  ──────────────────────  │
│  [Open selected node →]  │
│  ──────────────────────  │
│  Vision: anthropic ▾     │
└──────────────────────────┘
```

The provider picker at the bottom calls `GET /api/providers` and lets the
user switch without restarting the bridge (the bridge re-reads `VISION_PROVIDER`
at request time, or accepts an override in the request body).

### `epoch/ConvertPanel.tsx`

Shown after "Convert selection →":
- Displays the extracted LaTeX (editable text area so the user can fix OCR errors)
- Shows the compiled PDF preview
- Accept / Reject buttons
- On accept: "Create node" form (title, status, parent)

### `epoch/NodeFrame.tsx`

When a node is opened (Flow B):
- Loads the compiled PDF as a locked background frame element
- Adds a text element with the raw LaTeX above the PDF for reference
- All new strokes go onto a separate "annotations" layer

### Canvas element conventions

| Excalidraw element | Epoch meaning |
|---|---|
| Frame titled `node:<path>` | A loaded Epoch node reference |
| Text element with `data-epoch-latex` attribute | Editable LaTeX region |
| Any other stroke/shape | Ink (for conversion or annotation) |
| Image element in frame `ink:<uuid>` | Source ink, stored in `data/source-ink.png` |

---

## Docker Stack

Three containers, one network:

```yaml
# docker-compose.epoch-stack.yml (in Epoch repo root)
services:
  gitea:
    extends:
      file: gitea/docker-compose.yml
      service: gitea

  excalidraw:
    extends:
      file: ../Excalidraw/docker-compose.epoch.yml
      service: excalidraw

  epoch-bridge:
    build:
      context: .
      dockerfile: bridge/Dockerfile
    container_name: epoch-bridge
    ports:
      - "3002:3002"
    environment:
      - VISION_PROVIDER=${VISION_PROVIDER:-anthropic}
      - VISION_MODEL=${VISION_MODEL:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      - WORKSPACE_DIR=/workspace
    volumes:
      - ${WORKSPACE_DIR}:/workspace
    restart: unless-stopped
```

---

## Bridge Container Layout

```
epoch/
  bridge/
    Dockerfile             ← Node 20-alpine, copies dist/, installs deps
    server.ts              ← entry point: starts REST + MCP together
    vision/
      provider.ts          ← VisionProvider interface + factory
      anthropic.ts         ← AnthropicVisionProvider
      openai.ts            ← OpenAIVisionProvider
      gemini.ts            ← GeminiVisionProvider
      ollama.ts            ← OllamaVisionProvider
    routes/
      convert.ts           ← POST /api/convert
      compile.ts           ← POST /api/compile
      nodes.ts             ← GET/POST/PUT /api/nodes
      pdf.ts               ← GET /api/pdf/:path
      providers.ts         ← GET /api/providers
    mcp/
      server.ts            ← MCP server (stdio + SSE), reuses route handlers
      tools.ts             ← MCP tool definitions
```

---

## Implementation Order

1. **Bridge skeleton** — Express server, health check, `WORKSPACE_DIR` env var,
   Docker build, MCP server stub. Verifies it can import `workspace.ts`.

2. **`VisionProvider` interface + `AnthropicVisionProvider`** — just the
   interface and one working adapter before wiring the routes.

3. **`/api/nodes` routes + MCP node tools** — list, get, create, update.
   Validates that the Excalidraw app can already read the three-distance
   workspace and that Claude Code can call `list_nodes` via MCP.

4. **`/api/compile` + MCP `compile_latex`** — wraps `latex-compiler.ts`.

5. **`/api/convert` + MCP `convert_ink`** — first real handwriting test.
   Tune the system prompt against actual drawn samples.

6. **Remaining vision adapters** — OpenAI, Gemini, Ollama. Each is a small
   wrapper; most of the complexity is already in the interface.

7. **Excalidraw sidebar** — `EpochSidebar.tsx`, node list, provider picker.

8. **Flow B (node → canvas)** — `NodeFrame.tsx`, PDF reference layer, save
   back to node.

9. **Flow A (ink → node)** — `ConvertPanel.tsx`, accept/reject, create node,
   ink archive.

10. **Epoch webview integration** — add `showCanvas` mode to `App.tsx`;
    add `✏ Canvas` and `⇱ Pop out` buttons to the compile bar; update the
    extension's CSP to allow `frame-src http://localhost:3001`; wire
    `postMessage` listener for `epochCanvasEvent`.

11. **Deep-link / pop-out** — `⇱ Pop out` sends message to extension host →
    `vscode.env.openExternal`. Tablet users bookmark `http://localhost:3001`.

12. **`.mcp.json` update** — register `epoch-bridge` MCP server.

---

## Open Questions

- **Workspace discovery**: MVP is a single `WORKSPACE_DIR` env var. Phase 6
  adds a workspace switcher in the sidebar for multi-workspace setups.
- **Auth**: bridge is unauthed (localhost only) for now. Phase 6 adds token
  auth aligned with the user identity system.
- **Diff review for Flow B**: show a side-by-side diff of old vs new LaTeX
  before committing. Deferred to a later iteration.
- **Remote browser access**: bridge URL is derived from `window.location.hostname`
  at runtime so any client — same machine, LAN tablet, Tailscale remote —
  resolves correctly with no per-client config. Windows Firewall rules for
  ports 3001/3002 must be added manually (Docker does not punch those holes).
- **CORS**: the bridge must allow all origins, not just `localhost`, for LAN
  and Tailscale clients to reach `/api/*`.
- **Provider override per request**: the REST API and MCP tools can accept an
  optional `provider` / `model` field to override the env-var default for a
  single call. Useful for A/B testing transcription quality.
