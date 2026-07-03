import React, { useState } from 'react';
import type { SharedLayoutProps } from '../layoutProps.js';
import type { NodeEntry, ReviewRequest } from '../types.js';
import { LayoutTabs } from '../components/LayoutTabs.js';

type StatusFilter = 'All' | 'Sketch' | 'Conjecture' | 'Hypothesis' | 'Theorem';
const FILTERS: StatusFilter[] = ['All', 'Sketch', 'Conjecture', 'Hypothesis', 'Theorem'];

const STATUS_ACCENT: Record<string, string> = {
  Sketch:     'var(--vscode-descriptionForeground, #a6adc8)',
  Conjecture: '#89b4fa',
  Hypothesis: '#f9e2af',
  Theorem:    '#a6e3a1',
};

function getDirectChildren(nodes: NodeEntry[], parentPath: string | null): NodeEntry[] {
  if (parentPath === null) return nodes.filter((n) => !n.path.includes('/'));
  return nodes.filter((n) => {
    if (!n.path.startsWith(parentPath + '/')) return false;
    return !n.path.slice(parentPath.length + 1).includes('/');
  });
}

function getAncestors(nodes: NodeEntry[], path: string | null): NodeEntry[] {
  if (!path) return [];
  const parts = path.split('/');
  const result: NodeEntry[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const ap = parts.slice(0, i + 1).join('/');
    const e = nodes.find((n) => n.path === ap);
    if (e) result.push(e);
  }
  return result;
}

function pendingReviewsFor(reviews: ReviewRequest[], nodePath: string): ReviewRequest | undefined {
  return reviews.find((r) => r.nodePath === nodePath && r.status === 'pending');
}

export function NavigatorLayout(p: SharedLayoutProps) {
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [navPath, setNavPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const ancestors = getAncestors(p.nodes, navPath);
  const navEntry = navPath ? p.nodes.find((n) => n.path === navPath) : null;
  const directChildren = getDirectChildren(p.nodes, navPath);

  const filtered =
    filter === 'All' ? directChildren : directChildren.filter((n) => n.node.status === filter);

  const selectedEntry = selectedPath ? p.nodes.find((n) => n.path === selectedPath) : null;
  const selectedReview = selectedPath ? pendingReviewsFor(p.reviews, selectedPath) : undefined;
  const pendingCount = p.reviews.filter((r) => r.status === 'pending').length;
  const ri = p.remoteInfo;

  const navigateTo = (path: string | null) => {
    setNavPath(path);
    setSelectedPath(null);
  };

  const editNode = (path: string) => {
    p.onNavigate(path);
    p.onSetLayout('focus');
  };

  return (
    <div className="epoch-container">
      {/* ── Top bar ── */}
      <div className="lc-topbar">
        {/* Breadcrumb for navigator drill-down */}
        <div className="lc-breadcrumb">
          <button className="lc-crumb-root" onClick={() => navigateTo(null)}>
            {p.manifest.name}
          </button>
          {ancestors.map((a) => (
            <React.Fragment key={a.path}>
              <span className="lc-crumb-sep">›</span>
              <button className="lc-crumb" onClick={() => navigateTo(a.path)}>
                {a.node.title}
              </button>
            </React.Fragment>
          ))}
          {navEntry && (
            <>
              <span className="lc-crumb-sep">›</span>
              <span className="lc-crumb lc-crumb-cur">{navEntry.node.title}</span>
            </>
          )}
        </div>

        {/* Status filter */}
        <div className="lc-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`lc-filter-chip${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <LayoutTabs mode={p.layoutMode} onChange={p.onSetLayout} canvasUrl={p.canvasUrl} />

        {/* Quick actions */}
        <button className="btn secondary" onClick={p.onCompile} disabled={p.compiling}>
          {p.compiling ? '⬡…' : '⬡ Compile'}
        </button>
        {ri?.hasRemote && (
          <>
            <button className="btn secondary" onClick={p.onPush} disabled={p.syncing}>
              ↑ Push
            </button>
            <button className="btn secondary" onClick={p.onPull} disabled={p.syncing}>
              ↓ Pull
            </button>
          </>
        )}
        {navPath && (
          <button className="btn secondary" onClick={() => navigateTo(null)} title="Back to root">
            ↑ Up
          </button>
        )}
      </div>

      {p.error && <div className="error-banner">{p.error}</div>}

      {/* ── Body: card grid + detail panel ── */}
      <div className="lc-body">
        {/* Card grid */}
        <div className="lc-grid-area">
          {filtered.length === 0 && (
            <p className="muted" style={{ padding: '24px 20px' }}>
              {filter !== 'All' ? `No ${filter} nodes here.` : 'No nodes. Add one above.'}
            </p>
          )}
          <div className="lc-grid">
            {filtered.map((entry) => {
              const isSelected = entry.path === selectedPath;
              const review = pendingReviewsFor(p.reviews, entry.path);
              const childCount = getDirectChildren(p.nodes, entry.path).length;
              const accentColor = STATUS_ACCENT[entry.node.status] ?? '#888';

              return (
                <div
                  key={entry.path}
                  className={`lc-card${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedPath(isSelected ? null : entry.path)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedPath(isSelected ? null : entry.path)}
                >
                  <div className="lc-card-accent" style={{ background: accentColor }} />
                  <div className="lc-card-body">
                    <div className="lc-card-title">{entry.node.title}</div>
                    {entry.node.description && (
                      <div className="lc-card-desc">{entry.node.description}</div>
                    )}
                    <div className="lc-card-badges">
                      <span className={`status-badge status-${entry.node.status.toLowerCase()}`}>
                        {entry.node.status}
                      </span>
                      {review && (
                        <span
                          className="status-badge status-hypothesis"
                          style={{ marginLeft: 4 }}
                          title="Review pending"
                        >
                          ⏳ Review
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="lc-card-foot">
                    <span className="muted" style={{ fontSize: '0.8em' }}>
                      {childCount > 0 ? `${childCount} child${childCount !== 1 ? 'ren' : ''}` : ''}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {childCount > 0 && (
                        <button
                          className="btn secondary"
                          style={{ padding: '1px 7px', fontSize: '0.8em' }}
                          onClick={(e) => { e.stopPropagation(); navigateTo(entry.path); }}
                        >
                          Enter →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel — slides in when a card is selected */}
        {selectedEntry && (
          <div className="lc-detail">
            <div className="lc-detail-header">
              <div className="lc-detail-title">{selectedEntry.node.title}</div>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px' }}
                onClick={() => setSelectedPath(null)}
              >
                ✕
              </button>
            </div>

            <div className="lc-detail-body">
              <div className="ctx-section">
                <div className="ctx-section-label">Status</div>
                <span className={`status-badge status-${selectedEntry.node.status.toLowerCase()}`}>
                  {selectedEntry.node.status}
                </span>
                {selectedReview && (
                  <span className="status-badge status-hypothesis" style={{ marginLeft: 6 }}>
                    ⏳ {selectedReview.fromStatus} → {selectedReview.toStatus}
                  </span>
                )}
              </div>

              {selectedEntry.node.description && (
                <div className="ctx-section">
                  <div className="ctx-section-label">Description</div>
                  <div style={{ fontSize: '0.9em', lineHeight: 1.6 }}>
                    {selectedEntry.node.description}
                  </div>
                </div>
              )}

              {selectedEntry.node.tags && selectedEntry.node.tags.length > 0 && (
                <div className="ctx-section">
                  <div className="ctx-section-label">Tags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {selectedEntry.node.tags.map((t) => (
                      <span
                        key={t}
                        className="muted"
                        style={{
                          background: 'var(--vscode-input-background, #313244)',
                          border: '1px solid var(--vscode-input-border, #45475a)',
                          padding: '1px 7px',
                          borderRadius: 3,
                          fontSize: '0.82em',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedEntry.node.validationPath.length > 0 && (
                <div className="ctx-section">
                  <div className="ctx-section-label">Validation Path</div>
                  {selectedEntry.node.validationPath.map((dep, i) => (
                    <div key={i} className="ctx-dep">
                      <span className={`status-badge status-${dep.status.toLowerCase()}`}>
                        {dep.status}
                      </span>
                      <span className="ctx-dep-title">{dep.title}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="muted" style={{ fontSize: '0.78em', marginTop: 8 }}>
                Updated {new Date(selectedEntry.node.updatedAt).toLocaleString()}
              </div>
            </div>

            <div className="lc-detail-actions">
              <button className="btn" onClick={() => editNode(selectedEntry.path)}>
                ✎ Edit Node
              </button>
              {getDirectChildren(p.nodes, selectedEntry.path).length > 0 && (
                <button
                  className="btn secondary"
                  onClick={() => navigateTo(selectedEntry.path)}
                >
                  Enter →
                </button>
              )}
              {selectedReview && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    p.onOpenReview(selectedReview);
                    p.onSetLayout('focus');
                  }}
                >
                  ⏳ Review
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="epoch-sync-bar">
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
            <span className="sync-sep" />
            <span style={{ color: '#f9e2af', fontSize: '0.82em' }}>
              ⏳ {pendingCount} review{pendingCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: '0.8em' }}>
          {p.nodes.length} nodes
        </span>
      </div>
    </div>
  );
}
