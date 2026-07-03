# Epoch — In-App Peer Review Design

## Problem

The Gitea PR-based review flow requires the reviewer to evaluate a diff of `node.json`
in a generic git UI. This tells them nothing: they can't see the rendered LaTeX, the
proof structure, or the validation dependencies. Meaningful review requires reading the
actual mathematics.

**Goal:** review requests and approvals happen entirely inside Epoch, where the reviewer
has the PDF, the node editor, and the full dependency graph available.

---

## Core Idea

Review requests are plain JSON files committed to the workspace repo under `reviews/`.
They travel between collaborators via the existing push/pull sync. No Gitea API, no
branch gymnastics, no separate review system — just files in git.

```
workspace-root/
  reviews/
    2-2-4-lk3j9a.json        ← review request for the 2+2=4 node
    theorem-statement-m2x4f.json
  2-2-4/
    node.json                 ← status stays at Hypothesis until approved
    content.tex
  ...
```

---

## Data Schema

### `reviews/{slug}-{id}.json`

```ts
interface ReviewRequest {
  id: string;                           // crypto.randomUUID()
  nodePath: string;                     // workspace-relative, e.g. "2-2-4"
  nodeTitle: string;
  fromStatus: ProjectStatus;            // current status at time of request
  toStatus: ProjectStatus;             // proposed status (must be higher)
  requestedBy: { name: string; email: string };
  requestedAt: string;                  // ISO timestamp
  comment: string;                      // author's note to reviewer (what to check)
  contentSnapshot: string;              // full content.tex at time of request
  nodeSnapshot: ResearchNode;           // full node.json at time of request
  decisions: ReviewDecision[];
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
}

interface ReviewDecision {
  by: { name: string; email: string };
  at: string;                           // ISO timestamp
  verdict: 'approved' | 'rejected';
  comment: string;                      // required for rejected, optional for approved
}
```

**Filename**: `reviews/{nodePath.replace('/','-')}-{id.slice(0,6)}.json`

The node's actual `node.json` **does not change** when a review is requested. On
approval, the extension host writes the new status to `node.json` and commits it
alongside the updated review file. On rejection, only the review file is updated.

---

## Workflow

### Author side

1. Edit a node → raise its status to something higher in the dropdown.
2. The "Request Review" button appears (same trigger as the old Gitea flow).
3. Click → a compact dialog in NodeEditor asks for an optional cover note.
4. Extension host creates `reviews/{id}.json`, commits it, and pushes.
5. NodeEditor shows a yellow "Review pending" banner.
   - The node's status in `node.json` is NOT changed yet.
   - The dirty status dropdown is reset to the saved (lower) status.

### Reviewer side

1. Pull workspace → the new review file arrives in `reviews/`.
2. The sidebar "Reviews" section (see below) shows a badge with the count of pending reviews.
3. Click a pending review → the main content area switches to **ReviewView**.
4. ReviewView shows:
   - **Header**: `"{nodeTitle}" — {fromStatus} → {toStatus}`
   - **Author note** (from `comment`)
   - **Metadata**: validation path, requested-by, requested-at
   - **Content panel**: `contentSnapshot` rendered as a code block (read-only LaTeX source)
   - **"View in PDF" button**: triggers a workspace compile and switches to PDF mode,
     so the reviewer can read the typeset mathematics
   - **Decision row**: text area for comment + "Approve" and "Request Changes" buttons
5. Click "Approve" → extension host:
   - Appends decision to `decisions` array, sets `status: 'approved'`
   - Writes the new status into `node.json` via `writeNode`
   - Commits both files: `"review: approve "${nodeTitle}" → ${toStatus}"`
   - Pushes
6. Click "Request Changes" → same but `verdict: 'rejected'`, no status change.
7. Author pulls → sees result in the Reviews panel and on the node banner.

---

## UI Components

### `ReviewsPanel` (sidebar section, below the node list)

```
Reviews (2)
──────────────────────────────
⏳ 2+2=4  Hyp → Validated
⏳ Theorem statement  Conj → Hyp
──────────────────────────────
✓ Continued fractions  Sketch → Hyp
  Approved by you · 3d ago
```

- Clicking a pending review opens ReviewView.
- Clicking a resolved review shows it read-only.
- "Reviews (N)" count badge pulses when new reviews arrive after a pull.

### `ReviewView` (replaces main content area, like PdfViewer)

```
┌────────────────────────────────────────────────────────────┐
│  Review: "2+2=4" — Hypothesis → Validated                  │
│  Requested by William Bingham · 2h ago                      │
├─────────────────────────┬──────────────────────────────────┤
│  Author's note          │  content.tex (read-only)          │
│  ─────────────────────  │  ──────────────────────────────── │
│  "Please check the      │  \section*{2+2=4}                 │
│  Peano axiom steps,     │                                   │
│  especially S(S(2+0))   │  We establish the arithmetic...   │
│  = S(S(2))."            │  \begin{align*}                   │
│                         │    2 + 2 &= 2 + S(1) \\           │
│  Validation path        │    ...                            │
│  ─────────────────────  │  \end{align*}                     │
│  (none)                 │                                   │
│                         │  [ View in PDF ↗ ]                │
├─────────────────────────┴──────────────────────────────────┤
│  Comment (required for Request Changes):                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  [ Request Changes ]                    [ ✓ Approve ]      │
└────────────────────────────────────────────────────────────┘
```

"View in PDF" posts `{ type: 'compile' }` and sets `viewMode = 'pdf'` — the same
path as the existing Compile button, so no new infrastructure.

---

## New Files

| File | Purpose |
|---|---|
| `src/types/review.ts` | `ReviewRequest`, `ReviewDecision` interfaces + type guard |
| `src/core/reviews.ts` | `createReview`, `listReviews`, `submitDecision`, `getReview` |
| `src/webview/components/ReviewsPanel.tsx` | Sidebar reviews section |
| `src/webview/components/ReviewView.tsx` | Full review experience |

### `src/core/reviews.ts` API

```ts
export async function createReview(opts: {
  workspaceDir: string;
  nodePath: string;
  proposedStatus: ProjectStatus;
  comment: string;
  author: { name: string; email: string };
}): Promise<ReviewRequest>
// Writes reviews/{id}.json, git add + commit + push (push is best-effort)

export async function listReviews(workspaceDir: string): Promise<ReviewRequest[]>
// Reads all reviews/*.json, sorted by requestedAt desc

export async function submitDecision(opts: {
  workspaceDir: string;
  reviewId: string;
  verdict: 'approved' | 'rejected';
  comment: string;
  reviewer: { name: string; email: string };
}): Promise<ReviewRequest>
// Updates reviews/{id}.json; if approved, also calls writeNode to promote status
// git add + commit + push (push is best-effort)
```

---

## Modified Files

### `src/webview/types.ts`

Add to `ToExtension`:
```ts
| { type: 'listReviews' }
| { type: 'createReview'; nodePath: string; proposedStatus: string; comment: string }
| { type: 'submitDecision'; reviewId: string; verdict: 'approved' | 'rejected'; comment: string }
```

Add to `ToWebview`:
```ts
| { type: 'reviews'; reviews: ReviewRequest[] }
| { type: 'reviewCreated'; review: ReviewRequest }
| { type: 'decisionSubmitted'; review: ReviewRequest }
```

### `src/extension/extension.ts`

Add handlers for `listReviews`, `createReview`, `submitDecision`. After `submitDecision`
with `verdict: 'approved'`, also call `listNodes` and re-post `nodes` so the node's
new status appears in the sidebar immediately.

### `src/webview/App.tsx`

- Add `reviews` state (`ReviewRequest[]`), populated on `init` and refreshed after
  pull, `reviewCreated`, and `decisionSubmitted`.
- Add `activeReview` state: when set, the main content area shows `ReviewView`.
- `handleNavigate` clears `activeReview`.
- `handleOpenReview(review)` sets `activeReview` (clears `currentPath`).

### `src/webview/components/NodeEditor.tsx`

Replace the "Request Review → Gitea PR" flow with:
```
onRequestReview(node, proposedStatus, comment)
```
This posts `{ type: 'createReview', ... }` instead of `{ type: 'openReview', ... }`.

The review banner changes to show: pending/approved/rejected based on the review in
`reviews` state whose `nodePath === currentPath`.

### `src/mcp/server.ts`

Add tools: `create_review`, `list_reviews`, `submit_decision` (wrapping `reviews.ts`).

---

## What Gets Removed

- `src/tools/review.ts` — the Gitea PR helper (`openReview`, `parseGiteaRemote`,
  `giteaFetch`) is no longer needed. Delete it.
- The `openReview` / `reviewOpened` message types in `types.ts`.
- The `openReview` case in `extension.ts`.
- The `open_review` / `list_reviews` MCP tools that called the Gitea API.

The Gitea server remains useful as a git remote for push/pull sync, but it plays no
role in the review workflow.

---

## Git Layout Note

The `reviews/` folder is committed to the workspace repo (not gitignored). This means:
- Reviews sync automatically with push/pull — no extra transport needed.
- Git history preserves the full audit trail of who approved what and when.
- The `contentSnapshot` field captures the LaTeX at review time, so diffs work even if
  the author edits content during review.

A `.gitattributes` rule can mark `reviews/*.json` as `merge=ours` to avoid conflicts
if two reviewers submit decisions simultaneously — the second push will conflict; the
resolution is to re-read the file and append the second decision.

---

## Implementation Order

1. `src/types/review.ts` — define schema, write type guard
2. `src/core/reviews.ts` — `listReviews`, `createReview`, `submitDecision`
3. `src/extension/extension.ts` — wire up the three handlers; on `init` call `listReviews`
   and include reviews in the `init` message (or send a separate `reviews` message)
4. `src/webview/types.ts` — add new message types
5. `src/webview/App.tsx` — add reviews state + routing
6. `src/webview/components/ReviewsPanel.tsx` — sidebar section
7. `src/webview/components/ReviewView.tsx` — review experience
8. `src/webview/components/NodeEditor.tsx` — swap Gitea flow for in-app flow
9. Delete `src/tools/review.ts`, remove dead code from extension + MCP
10. Update `plan/plan.md` — mark Phase 4 review item, add Phase 5 heading
