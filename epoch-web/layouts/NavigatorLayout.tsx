'use client';

import { useState } from 'react';
import ActivityBar from '@/components/ActivityBar';
import BreadcrumbBar from '@/components/BreadcrumbBar';
import LayoutTabs from '@/components/LayoutTabs';
import DagCanvas from '@/components/DagCanvas';
import type { LayoutProps } from './types';

const FILTERS = ['All', 'Sketch', 'Conjecture', 'Hypothesis', 'Theorem'] as const;

export default function NavigatorLayout(p: LayoutProps) {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('grid');

  const visible = activeFilter === 'All'
    ? p.nodes
    : p.nodes.filter((n) => n.status === activeFilter);

  const selectedNode = p.nodes.find((n) => n.path === p.selectedPath) ?? null;

  return (
    <div className="lc-root">
      {/* Topbar */}
      <div className="lc-topbar">
        <BreadcrumbBar workspaceName={p.workspaceName} selectedPath={null} nodeTitle="" />
        <div className="lc-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`lc-chip lc-chip-${f.toLowerCase()}${activeFilter === f ? ' active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="lc-view-toggle">
          <button
            className={`lc-view-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            ⊞ Grid
          </button>
          <button
            className={`lc-view-btn${viewMode === 'graph' ? ' active' : ''}`}
            onClick={() => setViewMode('graph')}
            title="DAG graph view"
          >
            ⬡ Graph
          </button>
        </div>
        <LayoutTabs mode={p.layoutMode} onChange={p.onSetLayout} />
      </div>

      {/* Body */}
      <div className="lc-body">
        <ActivityBar
          sidebarMode={p.sidebarMode}
          panelOpen={false}
          onSidebarMode={p.onSetSidebarMode}
          onTogglePanel={p.onTogglePanel}
        />

        {viewMode === 'graph' ? (
          /* DAG graph view */
          <DagCanvas
            nodes={p.nodes}
            selectedPath={p.selectedPath}
            onSelect={(path) => {
              p.onSelect(path);
              p.onSetLayout('analytical');
            }}
          />
        ) : (
          /* Card grid view */
          <div className="lc-grid-wrap">
            {p.loadError && (
              <div className="lc-empty" style={{ color: 'var(--error)' }}>
                Bridge unreachable: {p.loadError}
              </div>
            )}
            {!p.loadError && visible.length === 0 && (
              <div className="lc-empty">
                No nodes{activeFilter !== 'All' ? ` with status "${activeFilter}"` : ''}
              </div>
            )}
            <div className="lc-grid">
              {visible.map((n) => (
                <button
                  key={n.path}
                  className={`lc-card${p.selectedPath === n.path ? ' selected' : ''}`}
                  onClick={() => p.onSelect(n.path)}
                >
                  <div className={`lc-card-stripe ${n.status}`} />
                  <div className="lc-card-body">
                    <div className="lc-card-title">{n.title}</div>
                    <span className={`status-badge ${n.status}`}>{n.status}</span>
                    {(n.tags?.length ?? 0) > 0 && (
                      <div className="lc-card-tags">
                        {n.tags.slice(0, 3).map((t) => (
                          <span key={t} className="tag-chip">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detail panel (grid mode only) */}
        {viewMode === 'grid' && selectedNode && (
          <div className="lc-detail">
            <div className="lc-detail-header">
              <span className={`status-badge ${selectedNode.status}`}>{selectedNode.status}</span>
              <div className="lc-detail-title">{p.nodeTitle || selectedNode.title}</div>
            </div>

            {p.nodeDescription && (
              <p className="lc-detail-desc">{p.nodeDescription}</p>
            )}

            {p.nodeTags.length > 0 && (
              <div className="lc-detail-tags">
                {p.nodeTags.map((t) => <span key={t} className="tag-chip">{t}</span>)}
              </div>
            )}

            {p.nodeValidationPath.length > 0 && (
              <div className="lc-detail-vp">
                <div className="lc-detail-vp-label">Validation Path</div>
                {p.nodeValidationPath.map((dep, i) => {
                  const live = p.nodes.find((n) => n.path === dep.nodePath);
                  return (
                    <div key={i} className="lc-detail-dep">
                      <span className={`status-badge ${live?.status ?? dep.status}`}>
                        {live?.status ?? dep.status}
                      </span>
                      <span>{dep.title}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="lc-detail-path">{p.selectedPath}</div>

            <div className="lc-detail-actions">
              <button className="primary" onClick={() => p.onSetLayout('analytical')}>
                Edit Node →
              </button>
              <button onClick={p.onCompile} disabled={p.compiling || !p.latex.trim()}>
                {p.compiling ? 'Compiling…' : 'Compile PDF'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .lc-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg);
        }
        .lc-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px 0 8px;
          height: var(--topbar-height);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .lc-filters {
          display: flex;
          gap: 4px;
          overflow-x: auto;
        }
        .lc-chip {
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 10px;
          background: var(--surface2);
          color: var(--text-muted);
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .lc-chip:hover { color: var(--text); }
        .lc-chip.active { color: var(--text); background: var(--surface3); border-color: var(--border); }
        .lc-chip-sketch.active     { color: var(--status-sketch);     border-color: var(--status-sketch); }
        .lc-chip-conjecture.active { color: var(--status-conjecture);  border-color: var(--status-conjecture); }
        .lc-chip-hypothesis.active { color: var(--status-hypothesis);  border-color: var(--status-hypothesis); }
        .lc-chip-theorem.active    { color: var(--status-theorem);     border-color: var(--status-theorem); }

        .lc-view-toggle {
          display: flex;
          gap: 2px;
          background: var(--surface2);
          border-radius: 6px;
          padding: 2px;
          flex-shrink: 0;
        }
        .lc-view-btn {
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 4px;
          background: transparent;
          color: var(--text-muted);
          border: none;
          white-space: nowrap;
        }
        .lc-view-btn:hover { color: var(--text); }
        .lc-view-btn.active { background: var(--surface3); color: var(--text); }

        .lc-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }
        .lc-grid-wrap {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          min-width: 0;
        }
        .lc-empty {
          color: var(--text-muted);
          font-size: 13px;
          padding: 32px;
          text-align: center;
        }
        .lc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }
        .lc-card {
          display: flex;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.12s, box-shadow 0.12s;
          padding: 0;
          min-height: 88px;
        }
        .lc-card:hover { border-color: var(--surface3); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .lc-card.selected { border-color: var(--accent-dim); box-shadow: 0 0 0 1px var(--accent-dim); }
        .lc-card-stripe {
          width: 4px;
          flex-shrink: 0;
          background: var(--status-sketch);
        }
        .lc-card-stripe.Conjecture { background: var(--status-conjecture); }
        .lc-card-stripe.Hypothesis { background: var(--status-hypothesis); }
        .lc-card-stripe.Theorem    { background: var(--status-theorem); }
        .lc-card-body {
          flex: 1;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .lc-card-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lc-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          margin-top: 2px;
        }

        .lc-detail {
          width: 280px;
          background: var(--surface);
          border-left: 1px solid var(--border);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
          overflow-y: auto;
          padding: 16px;
        }
        .lc-detail-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 12px;
        }
        .lc-detail-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.3;
        }
        .lc-detail-desc {
          font-size: 12px;
          color: var(--text-sub);
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .lc-detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 12px;
        }
        .lc-detail-vp {
          margin-bottom: 12px;
        }
        .lc-detail-vp-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          opacity: 0.7;
          margin-bottom: 6px;
        }
        .lc-detail-dep {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .lc-detail-path {
          font-size: 10px;
          color: var(--text-muted);
          font-family: monospace;
          margin-bottom: 16px;
        }
        .lc-detail-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: auto;
          padding-top: 12px;
        }
        .lc-detail-actions button { font-size: 12px; padding: 6px 12px; }
      `}</style>
    </div>
  );
}
