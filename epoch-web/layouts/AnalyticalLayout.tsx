'use client';

import Sidebar from '@/components/Sidebar';
import FileManager from '@/components/FileManager';
import ActivityBar from '@/components/ActivityBar';
import BreadcrumbBar from '@/components/BreadcrumbBar';
import LayoutTabs from '@/components/LayoutTabs';
import ContentArea from '@/components/ContentArea';
import ContextPanel from '@/components/ContextPanel';
import type { LayoutProps } from './types';

export default function AnalyticalLayout(p: LayoutProps) {
  return (
    <div className="la-root">
      {/* Topbar — full width */}
      <div className="la-topbar">
        <BreadcrumbBar
          workspaceName={p.workspaceName}
          selectedPath={p.selectedPath}
          nodeTitle={p.nodeTitle}
        />
        <LayoutTabs mode={p.layoutMode} onChange={p.onSetLayout} />
      </div>

      {/* Body — activity bar + side panel + content + context */}
      <div className="la-body">
        <ActivityBar
          sidebarMode={p.sidebarMode}
          panelOpen={p.panelOpen}
          onSidebarMode={p.onSetSidebarMode}
          onTogglePanel={p.onTogglePanel}
        />

        {p.panelOpen && (
          <div className="la-side-panel">
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

        <ContextPanel
          compiling={p.compiling}
          pdfUrl={p.pdfUrl}
          compileError={p.compileError}
          latex={p.latex}
          nodeStatus={p.nodeStatus}
          nodeTags={p.nodeTags}
          onCompile={p.onCompile}
        />
      </div>

      <style>{`
        .la-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg);
        }
        .la-topbar {
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
        .la-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }
        .la-side-panel {
          width: var(--side-panel-width);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--surface);
        }
      `}</style>
    </div>
  );
}
