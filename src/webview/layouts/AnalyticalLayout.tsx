import React from 'react';
import type { SharedLayoutProps } from '../layoutProps.js';
import { BreadcrumbBar } from '../components/BreadcrumbBar.js';
import { ContentArea } from '../components/ContentArea.js';
import { NodeTree } from '../components/NodeTree.js';
import { ContextPanel } from '../components/ContextPanel.js';
import { LayoutTabs } from '../components/LayoutTabs.js';

export function AnalyticalLayout(p: SharedLayoutProps) {
  const pendingCount = p.reviews.filter((r) => r.status === 'pending').length;
  const ri = p.remoteInfo;

  return (
    <div className="epoch-container">
      {/* ── Top bar: breadcrumb + layout switcher ── */}
      <div className="la-topbar">
        <BreadcrumbBar
          manifest={p.manifest}
          ancestors={p.ancestors}
          currentEntry={p.currentEntry}
          onNavigate={p.onNavigate}
        />
        <LayoutTabs mode={p.layoutMode} onChange={p.onSetLayout} canvasUrl={p.canvasUrl} />
      </div>

      {p.error && <div className="error-banner">{p.error}</div>}

      {/* ── Three columns ── */}
      <div className="la-body">
        {/* Left: full node tree */}
        <NodeTree
          nodes={p.nodes}
          currentPath={p.currentPath}
          reviews={p.reviews}
          workspaceTitle={p.manifest.name}
          onNavigate={p.onNavigate}
          onAdd={p.onAddNode}
        />

        {/* Center: main content */}
        <div className="la-content">
          <ContentArea
            manifest={p.manifest}
            nodeCount={p.nodes.length}
            showReview={p.showReview}
            showPdf={p.showPdf}
            showEditor={p.showEditor}
            showHistory={p.showHistory}
            activeReview={p.activeReview}
            pdfBase64={p.pdfBase64}
            pdfFileName={p.pdfFileName}
            currentPath={p.currentPath}
            editingNode={p.editingNode}
            currentEntry={p.currentEntry}
            allNodes={p.nodes}
            isDirty={p.isDirty}
            nodeReview={p.nodeReview}
            commits={p.commits}
            loadingHistory={p.loadingHistory}
            historyError={p.historyError}
            onNodeChange={p.onNodeChange}
            onSave={p.onSave}
            onOpenFolder={p.onOpenFolder}
            onRequestReview={p.onRequestReview}
            onViewReview={p.onOpenReview}
            onCompile={p.onCompile}
            onSubmitDecision={p.onSubmitDecision}
            onCloseReview={p.onCloseReview}
            onShowHistory={p.onShowHistory}
            onToggleView={p.onToggleView}
          />
        </div>

        {/* Right: aggregated context */}
        <ContextPanel
          compiling={p.compiling}
          compileResult={p.compileResult}
          hasPdf={p.pdfBase64 !== null}
          viewMode={p.viewMode}
          onCompile={p.onCompile}
          onToggleView={p.onToggleView}
          editingNode={p.editingNode}
          reviews={p.reviews}
          onOpenReview={p.onOpenReview}
          remoteInfo={p.remoteInfo}
          syncing={p.syncing}
          lastSyncResult={p.lastSyncResult}
          lastSyncAction={p.lastSyncAction}
          onPush={p.onPush}
          onPull={p.onPull}
          onRefreshRemote={p.onRefreshRemote}
          onOpenExternal={p.onOpenExternal}
        />
      </div>

      {/* ── Single bottom status bar ── */}
      <div className="la-statusbar">
        {ri ? (
          <>
            <span className="sync-branch">⎇ {ri.branch}</span>
            {ri.hasRemote && (
              <span
                className={`sync-delta ${ri.ahead === 0 && ri.behind === 0 ? 'sync-delta-clean' : 'sync-delta-dirty'}`}
              >
                ↑{ri.ahead} ↓{ri.behind}
              </span>
            )}
            {!ri.hasRemote && (
              <span className="sync-no-remote">no remote</span>
            )}
            <span className="sync-sep" />
          </>
        ) : (
          <span className="sync-loading">⟳ Checking remote…</span>
        )}

        {p.compileResult && (
          <span className={`compile-status ${p.compileResult.success ? 'success' : 'error'}`}>
            {p.compileResult.success ? '✓ PDF compiled' : '✗ Compile error'}
          </span>
        )}

        {pendingCount > 0 && (
          <>
            {p.compileResult && <span className="sync-sep" />}
            <span style={{ color: '#f9e2af', fontSize: '0.82em' }}>
              ⏳ {pendingCount} review{pendingCount !== 1 ? 's' : ''} pending
            </span>
          </>
        )}

        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: '0.8em' }}>
          {p.nodes.length} nodes · {p.manifest.name}
        </span>
      </div>
    </div>
  );
}
