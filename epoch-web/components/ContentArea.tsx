'use client';

import dynamic from 'next/dynamic';
import NodeHeader from './NodeHeader';
import PdfPanel from './PdfPanel';
import CanvasPanel from './CanvasPanel';
import GitLog from './GitLog';
import type { ContentTab } from '@/layouts/types';
import type { NodeSummary, ValidationPathEntry } from '@/lib/api';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });

interface Props {
  selectedPath: string | null;
  nodeTitle: string;
  nodeStatus: string;
  nodeDescription: string;
  nodeTags: string[];
  nodeValidationPath: ValidationPathEntry[];
  allNodes: NodeSummary[];
  latex: string;
  pdfUrl: string | null;
  compiling: boolean;
  compileError: string | null;
  contentTab: ContentTab;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  loadError: string | null;
  onLatexChange: (v: string) => void;
  onSave: (v: string) => Promise<void>;
  onSetContentTab: (t: ContentTab) => void;
  onTitleChange: (t: string) => void;
  onStatusChange: (s: string) => void;
  onDescriptionChange: (d: string) => void;
  onTagsChange: (t: string[]) => void;
  onValidationPathChange: (vp: ValidationPathEntry[]) => void;
  onDeleted: () => void;
}

const TABS: { id: ContentTab; label: string }[] = [
  { id: 'editor',  label: 'LaTeX'   },
  { id: 'pdf',     label: 'PDF'     },
  { id: 'canvas',  label: 'Canvas'  },
  { id: 'history', label: 'History' },
];

const SAVE_LABEL:  Record<string, string> = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Error' };
const SAVE_COLOR:  Record<string, string> = {
  saved:   'var(--text-muted)',
  saving:  'var(--accent)',
  unsaved: 'var(--warning)',
  error:   'var(--error)',
};

export default function ContentArea({
  selectedPath, nodeTitle, nodeStatus, nodeDescription, nodeTags,
  nodeValidationPath, allNodes,
  latex, pdfUrl, compiling, compileError, contentTab, saveStatus, loadError,
  onLatexChange, onSave, onSetContentTab,
  onTitleChange, onStatusChange, onDescriptionChange, onTagsChange, onValidationPathChange, onDeleted,
}: Props) {
  return (
    <div className="content-area">
      {/* Tab bar */}
      <div className="ca-tabbar">
        <div className="ca-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`ca-tab${contentTab === t.id ? ' active' : ''}`}
              onClick={() => onSetContentTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ca-save-status" style={{ color: SAVE_COLOR[saveStatus] }}>
          {selectedPath ? SAVE_LABEL[saveStatus] : ''}
        </div>
      </div>

      {/* Node header */}
      {selectedPath && (
        <NodeHeader
          path={selectedPath}
          title={nodeTitle}
          status={nodeStatus}
          description={nodeDescription}
          tags={nodeTags}
          validationPath={nodeValidationPath}
          allNodes={allNodes}
          onTitleChange={onTitleChange}
          onStatusChange={onStatusChange}
          onDescriptionChange={onDescriptionChange}
          onTagsChange={onTagsChange}
          onValidationPathChange={onValidationPathChange}
          onDeleted={onDeleted}
        />
      )}

      {/* Content panel */}
      <div className="ca-panel">
        {loadError && (
          <div className="ca-message ca-error">Bridge unreachable: {loadError}</div>
        )}
        {!selectedPath && !loadError && contentTab !== 'pdf' && (
          <div className="ca-message">Select a node from the sidebar</div>
        )}
        {selectedPath && contentTab === 'editor' && (
          <Editor
            value={latex}
            onChange={(v) => { onLatexChange(v); }}
            onSave={onSave}
          />
        )}
        {contentTab === 'pdf' && (
          <PdfPanel pdfUrl={pdfUrl} compiling={compiling} error={compileError} />
        )}
        {contentTab === 'canvas' && (
          <CanvasPanel key={selectedPath ?? 'workspace'} />
        )}
        {contentTab === 'history' && (
          <GitLog nodePath={selectedPath} />
        )}
      </div>

      <style>{`
        .content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
          background: var(--bg);
        }
        .ca-tabbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          height: 34px;
          gap: 8px;
        }
        .ca-tabs { display: flex; gap: 1px; }
        .ca-tab {
          padding: 3px 12px;
          background: transparent;
          color: var(--text-muted);
          border-radius: 4px;
          font-size: 12px;
          border-bottom: 2px solid transparent;
          border-radius: 0;
        }
        .ca-tab:hover { color: var(--text); background: var(--surface2); }
        .ca-tab.active {
          color: var(--text);
          border-bottom-color: var(--accent);
        }
        .ca-save-status {
          font-size: 11px;
          flex-shrink: 0;
          transition: color 0.2s;
        }
        .ca-panel {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .ca-message {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .ca-error { color: var(--error); }
      `}</style>
    </div>
  );
}
