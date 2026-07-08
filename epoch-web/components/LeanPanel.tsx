'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getApiBase } from '@/lib/api';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface LeanDiagnostic {
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface Props {
  nodePath: string | null;
}

type CheckStatus = 'idle' | 'checking' | 'ok' | 'errors';

const LEAN_STARTER = `-- Lean 4 proof
-- Needs: leanprover/lean4 Docker image (~800 MB, pulled on first use)

theorem example_theorem : 1 + 1 = 2 := by
  norm_num
`;

export default function LeanPanel({ nodePath }: Props) {
  const [content, setContent] = useState(LEAN_STARTER);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle');
  const [diagnostics, setDiagnostics] = useState<LeanDiagnostic[]>([]);
  const [rawOutput, setRawOutput] = useState('');
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    setCheckStatus('idle');
    setDiagnostics([]);
    setRawOutput('');
    if (!nodePath) { setContent(LEAN_STARTER); return; }
    fetch(`${getApiBase()}/lean/${encodeURIComponent(nodePath)}`)
      .then((r) => r.json() as Promise<{ content: string }>)
      .then((d) => setContent(d.content || LEAN_STARTER))
      .catch(() => setContent(LEAN_STARTER));
  }, [nodePath]);

  const save = useCallback(async () => {
    if (!nodePath) return;
    await fetch(`${getApiBase()}/lean/${encodeURIComponent(nodePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: contentRef.current }),
    }).catch(() => {});
  }, [nodePath]);

  const check = useCallback(async () => {
    if (!nodePath) return;
    setCheckStatus('checking');
    setDiagnostics([]);
    setRawOutput('');
    try {
      const res = await fetch(`${getApiBase()}/lean/${encodeURIComponent(nodePath)}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentRef.current }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        ok: boolean;
        diagnostics: LeanDiagnostic[];
        rawOutput: string;
      };
      setCheckStatus(data.ok ? 'ok' : 'errors');
      setDiagnostics(data.diagnostics ?? []);
      setRawOutput(data.rawOutput ?? '');
    } catch (err) {
      setCheckStatus('errors');
      setRawOutput(String(err));
    }
  }, [nodePath]);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;

  const statusLabel: Record<CheckStatus, string> = {
    idle: '',
    checking: 'Checking…',
    ok: '✓ Verified',
    errors: `✗ ${errorCount} error${errorCount !== 1 ? 's' : ''}`,
  };

  const statusColor: Record<CheckStatus, string> = {
    idle: 'transparent',
    checking: 'var(--text-muted)',
    ok: '#4ec994',
    errors: 'var(--error)',
  };

  const showDiagnostics = checkStatus === 'ok' || checkStatus === 'errors';

  return (
    <div className="lean-panel">
      <div className="lp-toolbar">
        <span className="lp-label">Lean 4</span>
        <div className="lp-actions">
          {checkStatus === 'checking' && <span className="lp-spinner" />}
          <span className="lp-status" style={{ color: statusColor[checkStatus] }}>
            {statusLabel[checkStatus]}
          </span>
          <button
            className="lp-btn"
            onClick={save}
            disabled={!nodePath}
            title="Save proof.lean (Ctrl+S)"
          >
            Save
          </button>
          <button
            className="lp-btn lp-primary"
            onClick={check}
            disabled={!nodePath || checkStatus === 'checking'}
            title="Check proof with Lean 4 in Docker"
          >
            {checkStatus === 'checking' ? 'Checking…' : 'Check'}
          </button>
        </div>
      </div>

      <div className="lp-editor">
        <MonacoEditor
          height="100%"
          value={content}
          onChange={(v) => setContent(v ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
            minimap: { enabled: false },
            wordWrap: 'on',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            padding: { top: 10 },
          }}
          beforeMount={(monaco) => {
            if (monaco.languages.getLanguages().some((l) => l.id === 'lean4')) return;
            monaco.languages.register({ id: 'lean4' });
            monaco.languages.setMonarchTokensProvider('lean4', {
              keywords: [
                'theorem', 'lemma', 'def', 'let', 'have', 'show', 'from',
                'by', 'fun', 'if', 'then', 'else', 'match', 'with', 'return',
                'import', 'namespace', 'open', 'end', 'section', 'variable',
                'example', 'noncomputable', 'private', 'protected', 'partial',
                'structure', 'class', 'instance', 'where', 'do', 'pure',
                'apply', 'exact', 'intro', 'cases', 'induction', 'simp',
                'ring', 'linarith', 'norm_num', 'omega', 'decide', 'rfl',
              ],
              tokenizer: {
                root: [
                  [/--.*$/, 'comment'],
                  [/\/\-/, 'comment', '@block_comment'],
                  [/#[a-z_]+/, 'keyword.control'],
                  [/[∀∃λΠΣ→←↔⟨⟩⟦⟧⊢⊥⊤∧∨¬≠≤≥∈∉∪∩⊆⊇αβγδεζη]/, 'keyword'],
                  [/[A-Z][a-zA-Z0-9_']*/, 'type.identifier'],
                  [/[a-z_][a-zA-Z0-9_']*/, {
                    cases: { '@keywords': 'keyword', '@default': 'identifier' },
                  }],
                  [/`[a-zA-Z][a-zA-Z0-9._']*/, 'type'],
                  [/"(?:[^"\\]|\\.)*"/, 'string'],
                  [/[0-9]+/, 'number'],
                  [/[:=<>(){}[\]|,.@]/, 'delimiter'],
                ],
                block_comment: [
                  [/-\//, 'comment', '@pop'],
                  [/./, 'comment'],
                ],
              },
            });
          }}
          onMount={(ed, monaco) => {
            const model = ed.getModel();
            if (model) monaco.editor.setModelLanguage(model, 'lean4');
            ed.addCommand(2048 + 49, () => { save(); }); // Ctrl+S
          }}
        />
      </div>

      {showDiagnostics && (
        <div className="lp-diagnostics">
          {diagnostics.length > 0 ? (
            diagnostics.map((d, i) => (
              <div key={i} className={`lp-diag lp-${d.severity}`}>
                <span className="lp-loc">:{d.line}:{d.col}</span>
                <span className="lp-msg">{d.message}</span>
              </div>
            ))
          ) : (
            checkStatus === 'ok' && (
              <div className="lp-diag lp-ok-msg">No errors — proof checks out.</div>
            )
          )}
          {checkStatus === 'errors' && diagnostics.length === 0 && rawOutput && (
            <pre className="lp-raw">{rawOutput}</pre>
          )}
        </div>
      )}

      <style>{`
        .lean-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--bg);
        }
        .lp-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          height: 36px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          gap: 8px;
        }
        .lp-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .lp-actions { display: flex; align-items: center; gap: 8px; }
        .lp-status {
          font-size: 12px;
          font-weight: 500;
          min-width: 72px;
          text-align: right;
        }
        .lp-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: lp-spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        .lp-btn {
          padding: 3px 10px;
          font-size: 12px;
          border-radius: 4px;
          background: var(--surface2, #2a2a2a);
          color: var(--text);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.1s;
        }
        .lp-btn:hover:not(:disabled) { background: var(--surface3, #333); }
        .lp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .lp-primary {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
        }
        .lp-primary:hover:not(:disabled) { filter: brightness(1.1); }
        .lp-editor { flex: 1; overflow: hidden; min-height: 0; }
        .lp-diagnostics {
          max-height: 200px;
          overflow-y: auto;
          border-top: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
          font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
        }
        .lp-diag {
          display: flex;
          gap: 8px;
          padding: 4px 12px;
          border-bottom: 1px solid var(--border);
          font-size: 12px;
          align-items: flex-start;
        }
        .lp-error { color: var(--error); }
        .lp-warning { color: var(--warning, #e6a817); }
        .lp-info { color: var(--text-muted); }
        .lp-ok-msg { color: #4ec994; font-size: 12px; }
        .lp-loc {
          color: var(--text-muted);
          flex-shrink: 0;
          font-size: 11px;
          padding-top: 1px;
          min-width: 48px;
        }
        .lp-msg { white-space: pre-wrap; word-break: break-word; }
        .lp-raw {
          padding: 8px 12px;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--text-muted);
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
