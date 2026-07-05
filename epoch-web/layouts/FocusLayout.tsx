'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import FileManager from '@/components/FileManager';
import ActivityBar from '@/components/ActivityBar';
import BreadcrumbBar from '@/components/BreadcrumbBar';
import LayoutTabs from '@/components/LayoutTabs';
import ContentArea from '@/components/ContentArea';
import type { LayoutProps } from './types';

type DrawerTab = 'nodes' | 'compile';

export default function FocusLayout(p: LayoutProps) {
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('compile');
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="lb-root">
      {/* Topbar */}
      <div className="lb-topbar">
        <BreadcrumbBar
          workspaceName={p.workspaceName}
          selectedPath={p.selectedPath}
          nodeTitle={p.nodeTitle}
        />
        <div className="lb-topbar-right">
          {p.compiling && <span className="lb-compiling-badge">Compiling…</span>}
          {p.pdfUrl && !p.compiling && <span className="lb-ready-badge">✓ PDF</span>}
          <button
            className={`lb-drawer-toggle${drawerOpen ? ' active' : ''}`}
            onClick={() => setDrawerOpen((v) => !v)}
            title="Toggle drawer"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zm1.5-.5a.5.5 0 0 0-.5.5v8h11v-8a.5.5 0 0 0-.5-.5h-11zm-.5 9.5v1.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V11.5h-12z"/>
            </svg>
          </button>
          <LayoutTabs mode={p.layoutMode} onChange={p.onSetLayout} />
        </div>
      </div>

      {/* Body */}
      <div className="lb-body">
        <ActivityBar
          sidebarMode={p.sidebarMode}
          panelOpen={p.panelOpen}
          onSidebarMode={p.onSetSidebarMode}
          onTogglePanel={p.onTogglePanel}
        />

        {/* Sliding side panel (overlay in Focus mode) */}
        {p.panelOpen && (
          <div className="lb-side-panel">
            {p.sidebarMode === 'nodes' ? (
              <Sidebar
                nodes={p.nodes}
                selectedPath={p.selectedPath}
                onSelect={p.onSelect}
                onCreate={p.onCreate}
                onRename={p.onRename}
                workspaceName={p.workspaceName}
              />
            ) : (
              <FileManager />
            )}
          </div>
        )}

        {/* Centered focus area */}
        <div className="lb-focus-wrap">
          <ContentArea
            selectedPath={p.selectedPath}
            nodeTitle={p.nodeTitle}
            nodeStatus={p.nodeStatus}
            nodeDescription={p.nodeDescription}
            nodeTags={p.nodeTags}
            latex={p.latex}
            pdfUrl={p.pdfUrl}
            compiling={p.compiling}
            compileError={p.compileError}
            contentTab={p.contentTab}
            saveStatus={p.saveStatus}
            loadError={p.loadError}
            onLatexChange={p.onLatexChange}
            onSave={p.onSave}
            onSetContentTab={p.onSetContentTab}
            onTitleChange={p.onTitleChange}
            onStatusChange={p.onStatusChange}
            onDescriptionChange={p.onDescriptionChange}
            onTagsChange={p.onTagsChange}
            onDeleted={p.onDeleted}
          />
        </div>
      </div>

      {/* Bottom drawer */}
      {drawerOpen && (
        <div className="lb-drawer">
          <div className="lb-drawer-tabbar">
            {(['compile', 'nodes'] as DrawerTab[]).map((t) => (
              <button
                key={t}
                className={`lb-drawer-tab${drawerTab === t ? ' active' : ''}`}
                onClick={() => setDrawerTab(t)}
              >
                {t === 'compile' ? 'Compile' : 'Nodes'}
              </button>
            ))}
          </div>

          {drawerTab === 'compile' && (
            <div className="lb-drawer-content">
              <button
                className="primary"
                onClick={p.onCompile}
                disabled={p.compiling || !p.latex.trim()}
                style={{ minWidth: 120 }}
              >
                {p.compiling ? 'Compiling…' : 'Compile PDF'}
              </button>
              {p.pdfUrl && !p.compileError && (
                <span style={{ color: 'var(--success)', fontSize: 12 }}>✓ PDF ready — switch to PDF tab to view</span>
              )}
              {p.compileError && (
                <span style={{ color: 'var(--error)', fontSize: 12, maxWidth: 500 }}>{p.compileError}</span>
              )}
            </div>
          )}

          {drawerTab === 'nodes' && (
            <div className="lb-drawer-nodes">
              {p.nodes.slice(0, 20).map((n) => (
                <button
                  key={n.path}
                  className={`lb-node-row${p.selectedPath === n.path ? ' active' : ''}`}
                  onClick={() => p.onSelect(n.path)}
                >
                  <span className={`lb-node-dot ${n.status}`} />
                  <span className="lb-node-title">{n.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .lb-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg);
        }
        .lb-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px 0 8px;
          height: var(--topbar-height);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          gap: 12px;
        }
        .lb-topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .lb-compiling-badge {
          font-size: 11px;
          color: var(--accent);
          animation: lb-pulse 1.2s ease-in-out infinite;
        }
        .lb-ready-badge { font-size: 11px; color: var(--success); }
        @keyframes lb-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .lb-drawer-toggle {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--text-muted);
          border-radius: 4px;
          padding: 0;
        }
        .lb-drawer-toggle:hover, .lb-drawer-toggle.active { color: var(--accent); background: var(--surface2); }

        .lb-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          min-height: 0;
          position: relative;
        }
        .lb-side-panel {
          width: var(--side-panel-width);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--surface);
        }
        .lb-focus-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          align-items: center;
          min-width: 0;
        }
        .lb-focus-wrap > .content-area {
          width: 100%;
          max-width: 900px;
        }

        .lb-drawer {
          height: var(--drawer-height);
          background: var(--surface);
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .lb-drawer-tabbar {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          padding: 0 8px;
        }
        .lb-drawer-tab {
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          padding: 5px 12px;
          border-radius: 0;
          border-bottom: 2px solid transparent;
        }
        .lb-drawer-tab:hover { color: var(--text); }
        .lb-drawer-tab.active { color: var(--text); border-bottom-color: var(--accent); }

        .lb-drawer-content {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 20px;
          overflow: hidden;
        }

        .lb-drawer-nodes {
          flex: 1;
          overflow-y: auto;
          padding: 6px 0;
        }
        .lb-node-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 4px 16px;
          background: transparent;
          color: var(--text-sub);
          font-size: 12px;
          border-radius: 0;
          text-align: left;
        }
        .lb-node-row:hover { background: var(--surface2); color: var(--text); }
        .lb-node-row.active { background: var(--surface2); color: var(--text); }
        .lb-node-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          background: var(--status-sketch);
        }
        .lb-node-dot.Conjecture { background: var(--status-conjecture); }
        .lb-node-dot.Hypothesis { background: var(--status-hypothesis); }
        .lb-node-dot.Theorem    { background: var(--status-theorem); }
        .lb-node-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
