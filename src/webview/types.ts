// Shared type declarations for the webview ↔ extension message protocol.
// Re-declares core types so the browser bundle never imports Node.js-only modules.
// Keep in sync with src/types/*.ts manually.

export type ProjectStatus = 'Sketch' | 'Conjecture' | 'Hypothesis' | 'Theorem';
export const PROJECT_STATUSES: ProjectStatus[] = [
  'Sketch',
  'Conjecture',
  'Hypothesis',
  'Theorem',
];

export interface NodeDependency {
  title: string;
  status: ProjectStatus;
  nodePath: string;
}

export interface ResearchNode {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  validationPath: NodeDependency[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface NodeEntry {
  path: string;
  node: ResearchNode;
}

export interface Manifest {
  id: string;
  name: string;
  description?: string;
  author: { name: string; email: string };
  createdAt: string;
}

export interface CompileResult {
  success: boolean;
  outputPath?: string;
  texFiles: string[];
  errors: string[];
  stdout?: string;
}

export interface RemoteInfo {
  url: string | null;
  /** URL without credentials for display (e.g. "localhost:3000/william/epoch"). */
  displayUrl: string | null;
  /** Full URL without credentials for browser navigation. */
  browseUrl: string | null;
  branch: string;
  ahead: number;
  behind: number;
  lastCommit?: string;
  hasRemote: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// In-app peer review types (mirrors src/types/review.ts)
// ---------------------------------------------------------------------------

export interface ReviewDecision {
  by: { name: string; email: string };
  at: string;
  verdict: 'approved' | 'rejected';
  comment: string;
}

export interface ReviewRequest {
  id: string;
  nodePath: string;
  nodeTitle: string;
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  requestedBy: { name: string; email: string };
  requestedAt: string;
  comment: string;
  contentSnapshot: string;
  nodeSnapshot: ResearchNode;
  decisions: ReviewDecision[];
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// Webview → Extension
// ---------------------------------------------------------------------------
export type ToExtension =
  | { type: 'ready' }
  | { type: 'navigateTo'; nodePath: string | null }
  | { type: 'saveNode'; nodePath: string; node: ResearchNode }
  | { type: 'addNode'; parentPath: string | null; title: string; description?: string }
  | { type: 'compile' }
  | { type: 'openFolder'; nodePath: string }
  | { type: 'sync'; action: 'push' | 'pull' }
  | { type: 'getRemoteInfo' }
  | { type: 'openExternal'; url: string }
  | { type: 'createReview'; nodePath: string; proposedStatus: ProjectStatus; comment: string }
  | { type: 'submitDecision'; reviewId: string; verdict: 'approved' | 'rejected'; comment: string };

// ---------------------------------------------------------------------------
// Extension → Webview
// ---------------------------------------------------------------------------
export type ToWebview =
  | { type: 'init'; workspaceDir: string; manifest: Manifest; nodes: NodeEntry[]; reviews: ReviewRequest[] }
  | { type: 'nodes'; nodes: NodeEntry[] }
  | { type: 'compileResult'; result: CompileResult }
  | { type: 'pdfData'; base64: string; fileName: string }
  | { type: 'remoteInfo'; info: RemoteInfo }
  | { type: 'syncResult'; result: SyncResult; action: 'push' | 'pull' }
  | { type: 'reviews'; reviews: ReviewRequest[] }
  | { type: 'error'; message: string };
