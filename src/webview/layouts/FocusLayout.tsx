import React, { useState } from 'react';
import type { SharedLayoutProps } from '../layoutProps.js';
import { BreadcrumbBar } from '../components/BreadcrumbBar.js';
import { ContentArea } from '../components/ContentArea.js';
import { ChildList } from '../components/ChildList.js';
import { ReviewsPanel } from '../components/ReviewsPanel.js';
import { LayoutTabs } from '../components/LayoutTabs.js';

type DrawerTab = 'nodes' | 'reviews' | 'compile' | 'sync';

export function FocusLayout(p: SharedLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('nodes');

  const pendingCount = p.reviews.filter((r) => r.status === 'pending').length;
  const ri = p.remoteInfo;

  const openDrawer = (tab: DrawerTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  return (
    <div className="epoch-container">
      {/* ── Top bar ── */}
      <div className="lb-topbar">
        <BreadcrumbBar
          manifest={p.manifest}
          ancestors={p.ancestors}
          currentEntry={p.currentEntry}
          onNavigate={p.onNavigate}
        />

        {/* Current node status badge */}
        {p.editingNode && (
          <span className={`status-badge status-${p.editingNode.status.toLowerCase()}`}>
            {p.editingNode.status}
          </span>
        )}

        {/* Quick indicators */}
        {pendingCount > 0 && (
          <button
            className="btn secondary"
            style={{ padding: '2px 9px', fontSize: '0.82em' }}
            onClick={() => openDrawer('reviews')}
            title="Open pending reviews"
          >
            ⏳ {pendingCount}
          </button>
        )}

        <div style={{ flex: 1 }} />

        <LayoutTabs mode={p.layoutMode} onChange={p.onSetLayout} canvasUrl={p.canvasUrl} />

        <button
          className={`btn secondary${drawerOpen ? ' active-drawer-btn' : ''}`}
          onClick={() => setDrawerOpen((o) => !o)}
          title="Toggle nodes & tools panel"
        >
          {drawerOpen ? '▾ Tools' : '▸ Tools'}
        </button>

        {p.editingNode && (
          <button className="btn" onClick={p.onSave} disabled={!p.isDirty}>
            Save
          </button>
        )}
      </div>

      {p.error && <div className="error-banner">{p.error}</div>}

      {/* ── Full-width content ── */}
      <div className="lb-content">
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

      {/* ── Bottom drawer ── */}
      {drawerOpen && (
        <div className="lb-drawer">
          <div className="lb-drawer-tabs">
            {(['nodes', 'reviews', 'compile', 'sync'] as DrawerTab[]).map((tab) => (
              <button
                key={tab}
                className={`lb-dtab${drawerTab === tab ? ' active' : ''}`}
                onClick={() => setDrawerTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'reviews' && pendingCount > 0 && (
                  <span className="review-badge" style={{ marginLeft: 5 }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
            <button
              className="lb-dtab"
              style={{ marginLeft: 'auto', paddingRight: 12 }}
              onClick={() => setDrawerOpen(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="lb-drawer-content">
            {drawerTab === 'nodes' && (
              <ChildList
                parentPath={p.currentPath}
                children={p.directChildren}
                onNavigate={p.onNavigate}
                onAdd={p.onAddNode}
              />
            )}

            {drawerTab === 'reviews' && (
              <ReviewsPanel reviews={p.reviews} onOpenReview={p.onOpenReview} />
            )}

            {drawerTab === 'compile' && (
              <div className="lb-drawer-pane">
                <button
                  className="btn"
                  onClick={p.onCompile}
                  disabled={p.compiling}
                >
                  {p.compiling ? 'Compiling…' : '⬡ Compile Workspace'}
                </button>
                {p.pdfBase64 !== null && (
                  <button className="btn secondary" onClick={p.onToggleView}>
                    {p.viewMode === 'pdf' ? '✎ Edit' : '⊞ View PDF'}
                  </button>
                )}
                {p.compileResult && (
                  <span
                    className={`compile-status ${p.compileResult.success ? 'success' : 'error'}`}
                    title={p.compileResult.errors.join('\n')}
                  >
                    {p.compileResult.success
                      ? '✓ PDF compiled'
                      : `✗ ${(p.compileResult.errors[0] ?? '').split('\n')[0] ?? 'Error'}`}
                  </span>
                )}
              </div>
            )}

            {drawerTab === 'sync' && (
              <div className="lb-drawer-pane">
                {!ri ? (
                  <span className="muted">Checking remote…</span>
                ) : (
                  <>
                    <span className="sync-branch" style={{ marginRight: 8 }}>
                      ⎇ {ri.branch}
                    </span>
                    {ri.hasRemote && (
                      <span
                        className={`sync-delta ${ri.ahead === 0 && ri.behind === 0 ? 'sync-delta-clean' : 'sync-delta-dirty'}`}
                        style={{ marginRight: 12 }}
                      >
                        ↑{ri.ahead} ↓{ri.behind}
                      </span>
                    )}
                    {ri.displayUrl && ri.browseUrl && (
                      <button
                        className="sync-url-btn"
                        onClick={() => p.onOpenExternal(ri.browseUrl!)}
                        style={{ marginRight: 12 }}
                      >
                        {ri.displayUrl}
                      </button>
                    )}
                    <button className="btn sync-btn" onClick={p.onPush} disabled={p.syncing}>
                      {p.syncing && p.lastSyncAction === 'push' ? '…' : '↑ Push'}
                    </button>
                    <button className="btn secondary sync-btn" onClick={p.onPull} disabled={p.syncing}>
                      {p.syncing && p.lastSyncAction === 'pull' ? '…' : '↓ Pull'}
                    </button>
                    <button className="btn secondary sync-btn icon" onClick={p.onRefreshRemote} disabled={p.syncing} title="Refresh">
                      ↺
                    </button>
                    {p.lastSyncResult && (
                      <span
                        className={`sync-result ${p.lastSyncResult.success ? 'success' : 'error'}`}
                        style={{ marginLeft: 8 }}
                      >
                        {p.lastSyncResult.success ? '✓' : '✗'} {p.lastSyncResult.message}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Thin status bar ── */}
      <div className="lb-statusbar">
        <button
          className="lb-compile-btn"
          onClick={p.onCompile}
          disabled={p.compiling}
        >
          {p.compiling ? '⬡ Compiling…' : '⬡ Compile'}
        </button>

        {p.compileResult && (
          <span className={`compile-status ${p.compileResult.success ? 'success' : 'error'}`}>
            {p.compileResult.success ? '✓ PDF compiled' : '✗ Error'}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {ri && (
          <>
            <span className="sync-branch">⎇ {ri.branch}</span>
            {ri.hasRemote && (
              <span
                className={`sync-delta ${ri.ahead === 0 && ri.behind === 0 ? 'sync-delta-clean' : 'sync-delta-dirty'}`}
              >
                ↑{ri.ahead} ↓{ri.behind}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
