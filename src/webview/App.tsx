import React, { useEffect, useState } from 'react';
import { vscode } from './vscode.js';
import type {
  Manifest,
  NodeEntry,
  ResearchNode,
  CompileResult,
  RemoteInfo,
  SyncResult,
  ReviewRequest,
  ProjectStatus,
  ToWebview,
} from './types.js';
import type { LayoutMode, SharedLayoutProps } from './layoutProps.js';
import { AnalyticalLayout } from './layouts/AnalyticalLayout.js';
import { FocusLayout } from './layouts/FocusLayout.js';
import { NavigatorLayout } from './layouts/NavigatorLayout.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDirectChildren(nodes: NodeEntry[], parentPath: string | null): NodeEntry[] {
  if (parentPath === null) {
    return nodes.filter((n) => !n.path.includes('/'));
  }
  return nodes.filter((n) => {
    if (!n.path.startsWith(parentPath + '/')) return false;
    const rest = n.path.slice(parentPath.length + 1);
    return !rest.includes('/');
  });
}

function getAncestors(nodes: NodeEntry[], currentPath: string | null): NodeEntry[] {
  if (!currentPath) return [];
  const parts = currentPath.split('/');
  const ancestors: NodeEntry[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const ancestorPath = parts.slice(0, i + 1).join('/');
    const entry = nodes.find((n) => n.path === ancestorPath);
    if (entry) ancestors.push(entry);
  }
  return ancestors;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  // Restore layout preference from VS Code webview state
  const savedState = vscode.getState() as { layoutMode?: LayoutMode } | undefined;

  const [ready, setReady] = useState(false);
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [nodes, setNodes] = useState<NodeEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<ResearchNode | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'pdf'>('edit');
  const [error, setError] = useState<string | null>(null);
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncAction, setLastSyncAction] = useState<'push' | 'pull' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [activeReview, setActiveReview] = useState<ReviewRequest | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(savedState?.layoutMode ?? 'analytical');
  const [canvasUrl, setCanvasUrl] = useState('');

  // Receive messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ToWebview;
      switch (msg.type) {
        case 'init':
          setWorkspaceDir(msg.workspaceDir);
          setManifest(msg.manifest);
          setNodes(msg.nodes);
          setReviews(msg.reviews);
          setCanvasUrl(msg.canvasUrl);
          setReady(true);
          setError(null);
          break;
        case 'nodes':
          setNodes(msg.nodes);
          break;
        case 'compileResult':
          setCompiling(false);
          setCompileResult(msg.result);
          break;
        case 'pdfData':
          setPdfBase64(msg.base64);
          setPdfFileName(msg.fileName);
          setViewMode('pdf');
          break;
        case 'remoteInfo':
          setRemoteInfo(msg.info);
          break;
        case 'syncResult':
          setSyncing(false);
          setLastSyncResult(msg.result);
          setLastSyncAction(msg.action);
          setLastSyncTime(new Date());
          break;
        case 'reviews':
          setReviews(msg.reviews);
          setActiveReview((prev) =>
            prev ? (msg.reviews.find((r) => r.id === prev.id) ?? null) : null,
          );
          break;
        case 'error':
          setCompiling(false);
          setSyncing(false);
          setError(msg.message);
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  // Keep editingNode in sync when nodes refresh (after save/add)
  useEffect(() => {
    if (currentPath) {
      const fresh = nodes.find((n) => n.path === currentPath);
      if (fresh && !isDirty) setEditingNode({ ...fresh.node });
    }
  }, [nodes, currentPath]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleNavigate = (path: string | null) => {
    setCurrentPath(path);
    setActiveReview(null);
    setCompileResult(null);
    setError(null);
    if (path) {
      const entry = nodes.find((n) => n.path === path);
      if (entry) {
        setEditingNode({ ...entry.node });
        setIsDirty(false);
      }
    } else {
      setEditingNode(null);
      setIsDirty(false);
    }
    vscode.postMessage({ type: 'navigateTo', nodePath: path });
  };

  const handleNodeChange = (node: ResearchNode) => {
    setEditingNode(node);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!currentPath || !editingNode) return;
    vscode.postMessage({ type: 'saveNode', nodePath: currentPath, node: editingNode });
    setNodes((prev) =>
      prev.map((n) => (n.path === currentPath ? { ...n, node: editingNode } : n)),
    );
    setIsDirty(false);
  };

  const handleAddNode = (parentPath: string | null, title: string) => {
    vscode.postMessage({ type: 'addNode', parentPath, title });
  };

  const handleOpenFolder = (nodePath: string) => {
    vscode.postMessage({ type: 'openFolder', nodePath });
  };

  const handleCompile = () => {
    setCompiling(true);
    setCompileResult(null);
    setError(null);
    vscode.postMessage({ type: 'compile' });
  };

  const handleToggleView = () => {
    setViewMode((m) => (m === 'pdf' ? 'edit' : 'pdf'));
  };

  const handlePush = () => {
    setSyncing(true);
    setLastSyncAction('push');
    vscode.postMessage({ type: 'sync', action: 'push' });
  };

  const handlePull = () => {
    setSyncing(true);
    setLastSyncAction('pull');
    vscode.postMessage({ type: 'sync', action: 'pull' });
  };

  const handleRefreshRemote = () => {
    setRemoteInfo(null);
    vscode.postMessage({ type: 'getRemoteInfo' });
  };

  const handleOpenExternal = (url: string) => {
    vscode.postMessage({ type: 'openExternal', url });
  };

  const handleRequestReview = (proposedStatus: ProjectStatus, comment: string) => {
    if (!currentPath) return;
    vscode.postMessage({ type: 'createReview', nodePath: currentPath, proposedStatus, comment });
  };

  const handleSubmitDecision = (
    reviewId: string,
    verdict: 'approved' | 'rejected',
    comment: string,
  ) => {
    vscode.postMessage({ type: 'submitDecision', reviewId, verdict, comment });
  };

  const handleOpenReview = (review: ReviewRequest) => {
    setActiveReview(review);
    setViewMode('edit');
  };

  const handleSetLayout = (mode: LayoutMode) => {
    setLayoutMode(mode);
    vscode.setState({ layoutMode: mode });
  };

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (!ready) {
    return (
      <div style={{ padding: 24 }} className="muted">
        Connecting to workspace…
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const ancestors = getAncestors(nodes, currentPath);
  const directChildren = getDirectChildren(nodes, currentPath);
  const currentEntry = currentPath ? nodes.find((n) => n.path === currentPath) ?? null : null;

  const nodeReview = currentPath
    ? (reviews.find((r) => r.nodePath === currentPath && r.status === 'pending') ??
       reviews.find((r) => r.nodePath === currentPath) ??
       null)
    : null;

  const showReview = activeReview !== null;
  const showPdf = !showReview && viewMode === 'pdf' && pdfBase64 !== null;
  const showEditor = !showReview && !showPdf && currentPath !== null && editingNode !== null;

  // ---------------------------------------------------------------------------
  // Shared props bundle
  // ---------------------------------------------------------------------------

  const layoutProps: SharedLayoutProps = {
    workspaceDir,
    manifest: manifest!,
    nodes,
    currentPath,
    ancestors,
    directChildren,
    currentEntry,
    editingNode,
    isDirty,
    nodeReview,
    compiling,
    compileResult,
    pdfBase64,
    pdfFileName,
    viewMode,
    showReview,
    showPdf,
    showEditor,
    error,
    remoteInfo,
    syncing,
    lastSyncResult,
    lastSyncAction,
    lastSyncTime,
    reviews,
    activeReview,
    layoutMode,
    canvasUrl,
    onNavigate: handleNavigate,
    onNodeChange: handleNodeChange,
    onSave: handleSave,
    onAddNode: handleAddNode,
    onOpenFolder: handleOpenFolder,
    onCompile: handleCompile,
    onToggleView: handleToggleView,
    onPush: handlePush,
    onPull: handlePull,
    onRefreshRemote: handleRefreshRemote,
    onOpenExternal: handleOpenExternal,
    onRequestReview: handleRequestReview,
    onSubmitDecision: handleSubmitDecision,
    onOpenReview: handleOpenReview,
    onCloseReview: () => setActiveReview(null),
    onSetLayout: handleSetLayout,
  };

  // ---------------------------------------------------------------------------
  // Render active layout
  // ---------------------------------------------------------------------------

  switch (layoutMode) {
    case 'analytical':
      return <AnalyticalLayout {...layoutProps} />;
    case 'focus':
      return <FocusLayout {...layoutProps} />;
    case 'navigator':
      return <NavigatorLayout {...layoutProps} />;
  }
}
