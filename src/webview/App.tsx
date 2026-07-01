import React, { useEffect, useState } from 'react';
import { vscode } from './vscode.js';
import type {
  Manifest,
  NodeEntry,
  ResearchNode,
  CompileResult,
  RemoteInfo,
  SyncResult,
  ReviewInfo,
  ToWebview,
} from './types.js';
import { BreadcrumbBar } from './components/BreadcrumbBar.js';
import { NodeEditor } from './components/NodeEditor.js';
import { ChildList } from './components/ChildList.js';
import { CompilePanel } from './components/CompilePanel.js';
import { PdfViewer } from './components/PdfViewer.js';
import { SyncPanel } from './components/SyncPanel.js';

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
// Workspace home (shown when no node is selected)
// ---------------------------------------------------------------------------

function WorkspaceHome({ manifest, nodeCount }: { manifest: Manifest; nodeCount: number }) {
  return (
    <div className="workspace-home">
      <h1>{manifest.name}</h1>
      {manifest.description && <p className="description">{manifest.description}</p>}
      <p className="muted">
        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} &middot; created{' '}
        {new Date(manifest.createdAt).toLocaleDateString()}
      </p>
      <p className="muted" style={{ marginTop: 12 }}>
        Select a node from the sidebar to view or edit it, or add a new top-level node.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
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
  // Sync state
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncAction, setLastSyncAction] = useState<'push' | 'pull' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  // Review state
  const [reviewPending, setReviewPending] = useState(false);
  const [lastReview, setLastReview] = useState<ReviewInfo | null>(null);
  const [reviewNodePath, setReviewNodePath] = useState<string | null>(null);

  // Receive messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ToWebview;
      switch (msg.type) {
        case 'init':
          setWorkspaceDir(msg.workspaceDir);
          setManifest(msg.manifest);
          setNodes(msg.nodes);
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
        case 'reviewOpened':
          setReviewPending(false);
          setLastReview(msg.info);
          break;
        case 'error':
          setCompiling(false);
          setSyncing(false);
          setError(msg.message);
          break;
      }
    };
    window.addEventListener('message', handler);
    // Signal to the extension that we're ready to receive data
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

  // When navigating to a node, load a fresh editable copy
  const handleNavigate = (path: string | null) => {
    setCurrentPath(path);
    setCompileResult(null);
    setError(null);
    // Clear review state when moving to a different node
    if (path !== reviewNodePath) {
      setLastReview(null);
      setReviewPending(false);
      setReviewNodePath(null);
    }
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
    // Optimistically update local nodes so the sidebar reflects title/status changes
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

  const handleRequestReview = (node: ResearchNode) => {
    if (!currentPath) return;
    setReviewPending(true);
    setReviewNodePath(currentPath);
    setLastReview(null);
    vscode.postMessage({ type: 'openReview', nodePath: currentPath, node });
  };

  if (!ready) {
    return (
      <div style={{ padding: 24 }} className="muted">
        Connecting to workspace…
      </div>
    );
  }

  const ancestors = getAncestors(nodes, currentPath);
  const directChildren = getDirectChildren(nodes, currentPath);
  const currentEntry = currentPath ? nodes.find((n) => n.path === currentPath) : null;

  return (
    <div className="epoch-container">
      <BreadcrumbBar
        manifest={manifest!}
        ancestors={ancestors}
        currentEntry={currentEntry ?? null}
        onNavigate={handleNavigate}
      />

      {error && (
        <div
          style={{
            padding: '8px 16px',
            background: '#2a1a1a',
            color: '#f38ba8',
            fontSize: '0.85em',
            borderBottom: '1px solid #45475a',
          }}
        >
          {error}
        </div>
      )}

      <div className="epoch-main">
        <div className="epoch-content">
          {viewMode === 'pdf' && pdfBase64 ? (
            <PdfViewer base64={pdfBase64} fileName={pdfFileName} />
          ) : currentPath && editingNode ? (
            <NodeEditor
              nodePath={currentPath}
              node={editingNode}
              savedStatus={currentEntry?.node.status ?? editingNode.status}
              allNodes={nodes}
              isDirty={isDirty}
              reviewPending={reviewPending}
              lastReview={reviewNodePath === currentPath ? lastReview : null}
              onChange={handleNodeChange}
              onSave={handleSave}
              onOpenFolder={handleOpenFolder}
              onRequestReview={handleRequestReview}
              onOpenExternal={handleOpenExternal}
            />
          ) : (
            <WorkspaceHome manifest={manifest!} nodeCount={nodes.length} />
          )}
        </div>

        <div className="epoch-sidebar">
          <ChildList
            parentPath={currentPath}
            children={directChildren}
            onNavigate={handleNavigate}
            onAdd={handleAddNode}
          />
        </div>
      </div>

      <CompilePanel
        workspaceDir={workspaceDir}
        compiling={compiling}
        result={compileResult}
        hasPdf={pdfBase64 !== null}
        viewMode={viewMode}
        onCompile={handleCompile}
        onToggleView={() => setViewMode((m) => (m === 'pdf' ? 'edit' : 'pdf'))}
      />
      <SyncPanel
        remoteInfo={remoteInfo}
        syncing={syncing}
        lastResult={lastSyncResult}
        lastAction={lastSyncAction}
        lastSyncTime={lastSyncTime}
        onPush={handlePush}
        onPull={handlePull}
        onRefresh={handleRefreshRemote}
        onOpenExternal={handleOpenExternal}
      />
    </div>
  );
}
