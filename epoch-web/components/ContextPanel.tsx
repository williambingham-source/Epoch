'use client';

interface Props {
  compiling: boolean;
  pdfUrl: string | null;
  compileError: string | null;
  latex: string;
  selectedPath: string | null;
  nodeStatus: string;
  nodeTags: string[];
  onCompile: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Sketch:      'var(--status-sketch)',
  Conjecture:  'var(--status-conjecture)',
  Hypothesis:  'var(--status-hypothesis)',
  Theorem:     'var(--status-theorem)',
};

export default function ContextPanel({
  compiling, pdfUrl, compileError, latex, selectedPath, nodeStatus, nodeTags, onCompile,
}: Props) {
  const hasNode = !!selectedPath;
  const hasLatex = !!latex.trim();
  // Disabled only when a node is open but its content is empty
  const btnDisabled = compiling || (hasNode && !hasLatex);
  const btnLabel = compiling
    ? 'Compiling…'
    : hasLatex
    ? 'Compile PDF'
    : 'Compile All Nodes';

  return (
    <div className="context-panel">
      {/* Compile section */}
      <div className="cp-section">
        <div className="cp-section-label">COMPILE</div>
        <button
          className="primary cp-compile-btn"
          onClick={onCompile}
          disabled={btnDisabled}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M3 3.5a.5.5 0 0 1 .757-.429l10 5.5a.5.5 0 0 1 0 .858l-10 5.5A.5.5 0 0 1 3 14.5v-11z"/>
          </svg>
          {btnLabel}
        </button>
        {pdfUrl && !compileError && (
          <div className="cp-status ok">✓ PDF ready</div>
        )}
        {compileError && (
          <div className="cp-error">{compileError}</div>
        )}
      </div>

      {/* Status */}
      <div className="cp-section">
        <div className="cp-section-label">STATUS</div>
        <span className={`status-badge ${nodeStatus}`}>{nodeStatus}</span>
      </div>

      {/* Tags */}
      {nodeTags.length > 0 && (
        <div className="cp-section">
          <div className="cp-section-label">TAGS</div>
          <div className="cp-tags">
            {nodeTags.map((t) => (
              <span key={t} className="tag-chip">{t}</span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .context-panel {
          width: var(--context-panel-width);
          background: var(--surface);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          flex-shrink: 0;
        }
        .cp-section {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cp-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.8px;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .cp-compile-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
          font-size: 12px;
          padding: 6px 12px;
        }
        .cp-status {
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cp-status.ok { color: var(--success); }
        .cp-error {
          font-size: 11px;
          color: var(--error);
          word-break: break-word;
          line-height: 1.4;
        }
        .cp-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
