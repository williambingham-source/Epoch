import React from 'react';
import type { CompileResult, ResearchNode, RemoteInfo, SyncResult, ReviewRequest } from '../types.js';

interface ContextPanelProps {
  compiling: boolean;
  compileResult: CompileResult | null;
  hasPdf: boolean;
  viewMode: 'edit' | 'pdf' | 'history';
  onCompile: () => void;
  onToggleView: () => void;
  editingNode: ResearchNode | null;
  reviews: ReviewRequest[];
  onOpenReview: (review: ReviewRequest) => void;
  remoteInfo: RemoteInfo | null;
  syncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncAction: 'push' | 'pull' | null;
  onPush: () => void;
  onPull: () => void;
  onRefreshRemote: () => void;
  onOpenExternal: (url: string) => void;
}

export function ContextPanel(p: ContextPanelProps) {
  const pendingReviews = p.reviews.filter((r) => r.status === 'pending');

  const errText = (() => {
    const raw = p.compileResult?.errors[0] ?? '';
    const line = raw.split('\n').find((l) => l.trim()) ?? raw;
    return line.length > 80 ? line.slice(0, 80) + '…' : line;
  })();

  return (
    <div className="ctx-panel">
      {/* ── Compile ── */}
      <div className="ctx-section">
        <div className="ctx-section-label">Compile</div>
        <button
          className="btn"
          onClick={p.onCompile}
          disabled={p.compiling}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {p.compiling ? 'Compiling…' : '⬡ Compile Workspace'}
        </button>
        {p.hasPdf && (
          <button
            className="btn secondary"
            onClick={p.onToggleView}
            style={{ width: '100%', marginTop: 6, justifyContent: 'center' }}
          >
            {p.viewMode === 'pdf' ? '✎ Edit' : '⊞ View PDF'}
          </button>
        )}
        {p.compileResult && (
          <div
            className={`compile-status ${p.compileResult.success ? 'success' : 'error'}`}
            style={{ marginTop: 6, fontSize: '0.82em' }}
            title={p.compileResult.errors.join('\n')}
          >
            {p.compileResult.success ? '✓ PDF compiled' : `✗ ${errText || 'Compilation failed'}`}
          </div>
        )}
      </div>

      {/* ── Validation path of current node ── */}
      {p.editingNode && p.editingNode.validationPath.length > 0 && (
        <div className="ctx-section">
          <div className="ctx-section-label">Validation Path</div>
          {p.editingNode.validationPath.map((dep, i) => (
            <div key={i} className="ctx-dep">
              <span className={`status-badge status-${dep.status.toLowerCase()}`}>
                {dep.status}
              </span>
              <span className="ctx-dep-title">{dep.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending reviews ── */}
      {pendingReviews.length > 0 && (
        <div className="ctx-section">
          <div className="ctx-section-label">
            Reviews
            <span className="review-badge" style={{ marginLeft: 6 }}>
              {pendingReviews.length}
            </span>
          </div>
          {pendingReviews.map((r) => (
            <button
              key={r.id}
              className="ctx-review-item"
              onClick={() => p.onOpenReview(r)}
            >
              <span>⏳</span>
              <div className="ctx-review-body">
                <div className="ctx-review-title">{r.nodeTitle}</div>
                <div className="muted" style={{ fontSize: '0.8em' }}>
                  {r.fromStatus} → {r.toStatus}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Sync ── */}
      <div className="ctx-section">
        <div className="ctx-section-label">Sync</div>
        {!p.remoteInfo ? (
          <span className="muted sync-loading" style={{ fontSize: '0.85em' }}>
            Checking remote…
          </span>
        ) : (
          <>
            <div className="muted" style={{ fontSize: '0.82em', marginBottom: 6 }}>
              ⎇ {p.remoteInfo.branch}
              {p.remoteInfo.hasRemote &&
                ` · ↑${p.remoteInfo.ahead} ↓${p.remoteInfo.behind}`}
            </div>
            {p.remoteInfo.hasRemote && p.remoteInfo.displayUrl && (
              <button
                className="sync-url-btn"
                style={{ display: 'block', marginBottom: 8, fontSize: '0.82em' }}
                onClick={() => p.onOpenExternal(p.remoteInfo!.browseUrl ?? '')}
              >
                {p.remoteInfo.displayUrl}
              </button>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn secondary sync-btn"
                onClick={p.onPush}
                disabled={p.syncing}
              >
                {p.syncing && p.lastSyncAction === 'push' ? '…' : '↑ Push'}
              </button>
              <button
                className="btn secondary sync-btn"
                onClick={p.onPull}
                disabled={p.syncing}
              >
                {p.syncing && p.lastSyncAction === 'pull' ? '…' : '↓ Pull'}
              </button>
              <button
                className="btn secondary sync-btn icon"
                onClick={p.onRefreshRemote}
                disabled={p.syncing}
                title="Refresh"
              >
                ↺
              </button>
            </div>
            {p.lastSyncResult && (
              <div
                className={`sync-result ${p.lastSyncResult.success ? 'success' : 'error'}`}
                style={{ marginTop: 6 }}
              >
                {p.lastSyncResult.success ? '✓' : '✗'} {p.lastSyncResult.message}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
