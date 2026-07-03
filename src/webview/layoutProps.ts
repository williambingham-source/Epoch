import type {
  Manifest,
  NodeEntry,
  ResearchNode,
  CompileResult,
  RemoteInfo,
  SyncResult,
  ReviewRequest,
  ProjectStatus,
} from './types.js';

export type LayoutMode = 'analytical' | 'focus' | 'navigator';

/** All state and handlers shared across the three layout components. */
export interface SharedLayoutProps {
  // === Workspace ===
  workspaceDir: string;
  manifest: Manifest;
  nodes: NodeEntry[];

  // === Navigation ===
  currentPath: string | null;
  ancestors: NodeEntry[];
  directChildren: NodeEntry[];
  currentEntry: NodeEntry | null;

  // === Node editing ===
  editingNode: ResearchNode | null;
  isDirty: boolean;
  nodeReview: ReviewRequest | null;

  // === Compile / PDF ===
  compiling: boolean;
  compileResult: CompileResult | null;
  pdfBase64: string | null;
  pdfFileName: string;
  viewMode: 'edit' | 'pdf';

  // === Content display flags ===
  showReview: boolean;
  showPdf: boolean;
  showEditor: boolean;

  // === Error ===
  error: string | null;

  // === Sync ===
  remoteInfo: RemoteInfo | null;
  syncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncAction: 'push' | 'pull' | null;
  lastSyncTime: Date | null;

  // === Reviews ===
  reviews: ReviewRequest[];
  activeReview: ReviewRequest | null;

  // === Layout ===
  layoutMode: LayoutMode;

  // === Handlers ===
  onNavigate: (path: string | null) => void;
  onNodeChange: (node: ResearchNode) => void;
  onSave: () => void;
  onAddNode: (parentPath: string | null, title: string) => void;
  onOpenFolder: (nodePath: string) => void;
  onCompile: () => void;
  onToggleView: () => void;
  onPush: () => void;
  onPull: () => void;
  onRefreshRemote: () => void;
  onOpenExternal: (url: string) => void;
  onRequestReview: (proposedStatus: ProjectStatus, comment: string) => void;
  onSubmitDecision: (reviewId: string, verdict: 'approved' | 'rejected', comment: string) => void;
  onOpenReview: (review: ReviewRequest) => void;
  onCloseReview: () => void;
  onSetLayout: (mode: LayoutMode) => void;
}
