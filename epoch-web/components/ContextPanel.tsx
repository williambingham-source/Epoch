'use client';

interface Props {
  compiling: boolean;
  compilingWorkspace: boolean;
  pdfUrl: string | null;
  compileError: string | null;
  latex: string;
  nodeStatus: string;
  nodeTags: string[];
  onCompile: () => void;
  onCompileWorkspace: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Sketch:      'var(--status-sketch)',
  Conjecture:  'var(--status-conjecture)',
  Hypothesis:  'var(--status-hypothesis)',
  Theorem:     'var(--status-theorem)',
};

export default function ContextPanel({
  compiling, compilingWorkspace, pdfUrl, compileError, latex,
  nodeStatus, nodeTags, onCompile, onCompileWorkspace,
}: Props) {
  return (
    <div className="context-panel">
      {/* Compile section */}
      <div className="cp-section">
        <div className="cp-section-label">COMPILE</div>
        <button
          className="primary cp-compile-btn"
          onClick={onCompile}
          disabled={compiling || !latex.trim()}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M3 3.5a.5.5 0 0 1 .757-.429l10 5.5a.5.5 0 0 1 0 .858l-10 5.5A.5.5 0 0 1 3 14.5v-11z"/>
          </svg>
          {compiling ? 'Compiling…' : 'Compile PDF'}
        </button>
        {pdfUrl && !compileError && (
          <div className="cp-status ok">✓ PDF ready</div>
        )}
        {compileError && (
          <div className="cp-error">{compileError}</div>
        )}
        <button
          className="cp-ws-btn"
          onClick={onCompileWorkspace}
          disabled={compilingWorkspace}
          title="Compile all nodes into a single PDF"
        >
          {compilingWorkspace ? 'Compiling workspace…' : '⬇ All Nodes PDF'}
        </button>
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
        .cp-ws-btn {
          background: var(--surface2, #313244);
          border: 1px solid var(--border, #45475a);
          color: var(--text-sub, #a6adc8);
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          text-align: left;
          transition: color 0.1s;
        }
        .cp-ws-btn:hover:not(:disabled) { color: var(--text, #cdd6f4); }
        .cp-ws-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .cp-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
