'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getApiBase } from '@/lib/api';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Props {
  nodePath: string | null;
}

type RunStatus = 'idle' | 'running' | 'done' | 'error';

const SAGE_STARTER = `# SageMath computation
# Needs: sagemath/sagemath Docker image (~3 GB, pulled on first use)
# SageMath syntax: use ^, SR(), symbolic variables, latex(expr), etc.

var('alpha')
alpha = (sqrt(5) - 1) / 2
pts = sorted([frac(k * alpha) for k in range(1, 9)])
gaps = [pts[i+1] - pts[i] for i in range(7)] + [1 + pts[0] - pts[-1]]
print("Distinct gap values:")
print(set(gaps))
print("LaTeX for alpha:")
print(latex(alpha))
`;

export default function SagePanel({ nodePath: _nodePath }: Props) {
  const [code, setCode] = useState(SAGE_STARTER);
  const [output, setOutput] = useState('');
  const [stderr, setStderr] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>('idle');
  const codeRef = useRef(code);
  codeRef.current = code;

  const run = useCallback(async () => {
    setStatus('running');
    setOutput('');
    setStderr(null);
    try {
      const res = await fetch(`${getApiBase()}/sage/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeRef.current }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { output: string; stderr: string | null };
      setOutput(data.output);
      setStderr(data.stderr);
      setStatus('done');
    } catch (err) {
      setOutput(String(err));
      setStatus('error');
    }
  }, []);

  const showOutput = status !== 'idle';

  return (
    <div className="sage-panel">
      <div className="sp-toolbar">
        <span className="sp-label">SageMath</span>
        <div className="sp-actions">
          {status === 'running' && <span className="sp-spinner" />}
          {status === 'done' && <span className="sp-badge sp-ok">✓ Done</span>}
          {status === 'error' && <span className="sp-badge sp-err">✗ Error</span>}
          <button
            className="sp-btn sp-primary"
            onClick={run}
            disabled={status === 'running'}
            title="Run in SageMath Docker container (Ctrl+Enter)"
          >
            {status === 'running' ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      <div className="sp-editor">
        <MonacoEditor
          height="100%"
          language="python"
          value={code}
          onChange={(v) => setCode(v ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
            minimap: { enabled: false },
            wordWrap: 'on',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            tabSize: 4,
            padding: { top: 10 },
          }}
          onMount={(ed) => {
            ed.addCommand(
              // Ctrl+Enter to run
              2048 + 3,
              () => { run(); },
            );
          }}
        />
      </div>

      {showOutput && (
        <div className="sp-output-area">
          <div className="sp-output-header">
            <span className="sp-output-label">Output</span>
            <button
              className="sp-clear"
              onClick={() => { setOutput(''); setStderr(null); setStatus('idle'); }}
              title="Clear output"
            >
              Clear
            </button>
          </div>
          <div className="sp-output">
            {status === 'running' && !output && (
              <span className="sp-hint">Running…</span>
            )}
            {output && <pre className="sp-result">{output}</pre>}
            {stderr && <pre className="sp-stderr">{stderr}</pre>}
          </div>
        </div>
      )}

      <style>{`
        .sage-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--bg);
        }
        .sp-toolbar {
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
        .sp-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .sp-actions { display: flex; align-items: center; gap: 8px; }
        .sp-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: sp-spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        .sp-badge {
          font-size: 12px;
          font-weight: 500;
        }
        .sp-ok { color: #4ec994; }
        .sp-err { color: var(--error); }
        .sp-btn {
          padding: 3px 10px;
          font-size: 12px;
          border-radius: 4px;
          background: var(--surface2, #2a2a2a);
          color: var(--text);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.1s;
        }
        .sp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sp-primary {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
        }
        .sp-primary:hover:not(:disabled) { filter: brightness(1.1); }
        .sp-editor { flex: 1; overflow: hidden; min-height: 0; }
        .sp-output-area {
          flex-shrink: 0;
          max-height: 40%;
          min-height: 80px;
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--border);
          overflow: hidden;
        }
        .sp-output-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 12px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .sp-output-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }
        .sp-clear {
          font-size: 11px;
          color: var(--text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0 2px;
        }
        .sp-clear:hover { color: var(--text); }
        .sp-output {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px;
          font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
        }
        .sp-hint { color: var(--text-muted); font-size: 12px; }
        .sp-result {
          margin: 0;
          font-size: 12px;
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .sp-stderr {
          margin: 6px 0 0;
          font-size: 11px;
          color: var(--warning, #e6a817);
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
