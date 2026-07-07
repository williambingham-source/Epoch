'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBase } from '../lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;

interface NodeSummary { path: string; title: string; status: string; }
interface ConvertResult { latex: string; confidence: string; model: string; provider: string; png: string | null; }
interface Bbox { x: number; y: number; w: number; h: number; }

type Phase = 'idle' | 'converting' | 'done' | 'saving' | 'error';
type ReplacePhase = 'idle' | 'replacing' | 'done' | 'error';

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#a6e3a1', medium: '#f9e2af', low: '#f38ba8',
};

function randomId() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

interface Props {
  api: ExcalidrawAPI;
  nodePath: string | null;
}

export default function EpochPanel({ api, nodePath }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [latex, setLatex] = useState('');
  const [confidence, setConfidence] = useState('');
  const [providerInfo, setProviderInfo] = useState('');
  const [hint, setHint] = useState('');
  const [compiledPng, setCompiledPng] = useState<string | null>(null);
  const [capturedIds, setCapturedIds] = useState<Set<string>>(new Set());
  const [capturedBbox, setCapturedBbox] = useState<Bbox | null>(null);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [saveMode, setSaveMode] = useState<'existing' | 'new'>('existing');
  const [saveResult, setSaveResult] = useState<'ok' | 'error' | null>(null);
  const [replacePhase, setReplacePhase] = useState<ReplacePhase>('idle');
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Pre-select the current node when it changes
  useEffect(() => {
    if (nodePath) setSelectedNode(nodePath);
  }, [nodePath]);

  useEffect(() => {
    fetch(`${getApiBase()}/nodes`)
      .then((r) => r.json())
      .then((data: NodeSummary[]) => {
        setNodes(data);
        if (!nodePath && data.length > 0) setSelectedNode(data[0].path);
      })
      .catch(() => {});
  }, [nodePath]);

  const convert = useCallback(async () => {
    if (!api) return;
    setPhase('converting');
    setError(null);
    setSaveResult(null);
    setLatex('');
    setCompiledPng(null);
    setReplacePhase('idle');
    setReplaceError(null);

    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();

      const ids = new Set<string>(elements.map((el: { id: string }) => el.id));
      setCapturedIds(ids);
      if (elements.length > 0) {
        const minX = Math.min(...elements.map((el: { x: number }) => el.x));
        const minY = Math.min(...elements.map((el: { y: number }) => el.y));
        const maxX = Math.max(...elements.map((el: { x: number; width: number }) => el.x + el.width));
        const maxY = Math.max(...elements.map((el: { y: number; height: number }) => el.y + el.height));
        setCapturedBbox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      } else {
        setCapturedBbox(null);
      }

      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportBackground: true },
        files,
        exportPadding: 16,
        mimeType: 'image/png',
      });

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch(`${getApiBase()}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, hint: hint || undefined }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as ConvertResult;
      setLatex(result.latex);
      setConfidence(result.confidence);
      setProviderInfo(`${result.provider} / ${result.model}`);
      setCompiledPng(result.png);
      setPhase('done');
    } catch (err) {
      setError(String(err));
      setPhase('error');
    }
  }, [api, hint]);

  const save = useCallback(async () => {
    setPhase('saving');
    setSaveResult(null);
    try {
      if (saveMode === 'new') {
        await fetch(`${getApiBase()}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentPath: '', title: newTitle, latex }),
        });
        const list = (await fetch(`${getApiBase()}/nodes`).then((r) => r.json())) as NodeSummary[];
        setNodes(list);
        setNewTitle('');
        setSaveMode('existing');
      } else {
        await fetch(`${getApiBase()}/nodes/${encodeURIComponent(selectedNode)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latex, commitMessage: 'update via canvas' }),
        });
      }
      setSaveResult('ok');
      setPhase('done');
    } catch (err) {
      setError(String(err));
      setSaveResult('error');
      setPhase('done');
    }
  }, [saveMode, selectedNode, newTitle, latex]);

  const replaceOnCanvas = useCallback(async () => {
    if (!api || !capturedBbox || capturedIds.size === 0 || !compiledPng) return;
    setReplacePhase('replacing');
    setReplaceError(null);
    try {
      const fileId = randomId();
      const dataURL = `data:image/png;base64,${compiledPng}`;
      api.addFiles([{ id: fileId, mimeType: 'image/png', dataURL, created: Date.now(), lastRetrieved: Date.now() }]);
      api.updateScene({
        elements: [
          ...api.getSceneElements().filter((el: { id: string }) => !capturedIds.has(el.id)),
          {
            type: 'image', id: randomId(), x: capturedBbox.x, y: capturedBbox.y,
            width: capturedBbox.w, height: capturedBbox.h, fileId, status: 'saved',
            angle: 0, opacity: 100, isDeleted: false, version: 1, versionNonce: 0,
            seed: 0, groupIds: [], frameId: null, boundElements: null,
            updated: Date.now(), link: null, locked: false,
          },
        ],
      });
      setCapturedIds(new Set());
      setReplacePhase('done');
    } catch (err) {
      setReplaceError(String(err));
      setReplacePhase('error');
    }
  }, [api, capturedBbox, capturedIds, compiledPng]);

  const canSave = (phase === 'done' || saveResult !== null) && latex.trim() !== '' &&
    (saveMode === 'existing' ? selectedNode !== '' : newTitle.trim() !== '');

  return (
    <div className="ep-panel">
      <div className="ep-header">
        <svg className="ep-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="4" r="2.5" /><circle cx="4" cy="15" r="2.5" /><circle cx="16" cy="15" r="2.5" />
          <line x1="10" y1="6.5" x2="4" y2="12.5" /><line x1="10" y1="6.5" x2="16" y2="12.5" />
        </svg>
        <div>
          <div className="ep-title">Epoch</div>
          <div className="ep-sub">ink → LaTeX</div>
        </div>
      </div>

      <div className="ep-field">
        <label className="ep-label">Hint</label>
        <input className="ep-input" placeholder="e.g. triangle inequality proof"
          value={hint} onChange={(e) => setHint(e.target.value)} disabled={phase === 'converting'} />
      </div>

      <button className={`ep-btn-primary${phase === 'converting' ? ' loading' : ''}`}
        onClick={convert} disabled={!api || phase === 'converting' || phase === 'saving'}>
        {phase === 'converting' ? '⟳ Converting…' : '⬡ Convert Canvas to LaTeX'}
      </button>

      {phase === 'error' && error && <div className="ep-error">{error}</div>}

      {latex !== '' && (
        <div className="ep-result">
          <div className="ep-result-header">
            <span className="ep-label">LaTeX</span>
            {confidence && (
              <span className="ep-confidence" style={{ color: CONFIDENCE_COLOR[confidence] ?? 'inherit' }}>
                {confidence}
              </span>
            )}
            <button className="ep-btn-copy" onClick={() => navigator.clipboard.writeText(latex)} title="Copy">⎘</button>
          </div>
          <textarea className="ep-latex-area" value={latex} onChange={(e) => setLatex(e.target.value)}
            rows={6} spellCheck={false} />
          {providerInfo && <div className="ep-provider-info">{providerInfo}</div>}

          {compiledPng && (
            <div className="ep-preview">
              <img className="ep-preview-img" src={`data:image/png;base64,${compiledPng}`} alt="Compiled LaTeX" />
            </div>
          )}

          {compiledPng && capturedBbox && capturedIds.size > 0 && (
            <div className="ep-replace-section">
              <button className={`ep-btn-replace${replacePhase === 'replacing' ? ' loading' : ''}`}
                onClick={replaceOnCanvas} disabled={replacePhase === 'replacing'}>
                {replacePhase === 'done' ? '✓ Canvas updated' : '⇄ Replace ink with compiled PNG'}
              </button>
              {replacePhase === 'error' && replaceError && <div className="ep-error">{replaceError}</div>}
            </div>
          )}

          <div className="ep-save-section">
            <div className="ep-save-tabs">
              <button className={`ep-save-tab${saveMode === 'existing' ? ' active' : ''}`} onClick={() => setSaveMode('existing')}>Existing node</button>
              <button className={`ep-save-tab${saveMode === 'new' ? ' active' : ''}`} onClick={() => setSaveMode('new')}>New node</button>
            </div>
            {saveMode === 'existing' ? (
              <select className="ep-select" value={selectedNode} onChange={(e) => setSelectedNode(e.target.value)}>
                {nodes.length === 0 && <option value="">No nodes found</option>}
                {nodes.map((n) => <option key={n.path} value={n.path}>{n.title} · {n.status}</option>)}
              </select>
            ) : (
              <input className="ep-input" placeholder="New node title…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            )}
            <button className="ep-btn-save" onClick={save} disabled={!canSave || phase === 'saving' || phase === 'converting'}>
              {phase === 'saving' ? '⟳ Saving…' : '↓ Save to Workspace'}
            </button>
            {saveResult === 'ok' && <div className="ep-save-ok">✓ Saved to workspace</div>}
            {saveResult === 'error' && error && <div className="ep-error">{error}</div>}
          </div>
        </div>
      )}

      <style>{`
        .ep-panel {
          width: 260px; flex-shrink: 0;
          background: #1e1e2e; border-left: 1px solid #313244;
          display: flex; flex-direction: column; gap: 10px;
          padding: 12px; overflow-y: auto; font-size: 12px;
          color: #cdd6f4;
        }
        .ep-header { display:flex; align-items:center; gap:8px; padding-bottom:8px; border-bottom:1px solid #313244; }
        .ep-icon { width:20px; height:20px; color:#89b4fa; flex-shrink:0; }
        .ep-title { font-size:13px; font-weight:600; }
        .ep-sub { font-size:10px; color:#6c7086; }
        .ep-field { display:flex; flex-direction:column; gap:4px; }
        .ep-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6c7086; }
        .ep-input {
          background:#313244; border:1px solid #45475a; border-radius:4px;
          color:#cdd6f4; font-size:12px; padding:5px 8px; outline:none; width:100%; box-sizing:border-box;
        }
        .ep-input:focus { border-color:#89b4fa; }
        .ep-btn-primary {
          background:#89b4fa; color:#1e1e2e; border:none; border-radius:5px;
          padding:7px 10px; font-size:12px; font-weight:600; cursor:pointer; width:100%; transition:opacity .12s;
        }
        .ep-btn-primary:hover:not(:disabled) { opacity:.85; }
        .ep-btn-primary:disabled { opacity:.45; cursor:not-allowed; }
        .ep-error { color:#f38ba8; font-size:11px; background:rgba(243,139,168,.1); border-radius:4px; padding:5px 8px; }
        .ep-result { display:flex; flex-direction:column; gap:8px; }
        .ep-result-header { display:flex; align-items:center; gap:6px; }
        .ep-confidence { font-size:10px; font-weight:700; }
        .ep-btn-copy { background:none; border:1px solid #45475a; color:#6c7086; border-radius:3px; padding:1px 6px; font-size:11px; cursor:pointer; margin-left:auto; }
        .ep-btn-copy:hover { color:#cdd6f4; }
        .ep-latex-area {
          background:#181825; border:1px solid #45475a; border-radius:4px;
          color:#cdd6f4; font-size:11px; font-family:monospace; padding:6px 8px;
          resize:vertical; outline:none; width:100%; box-sizing:border-box;
        }
        .ep-latex-area:focus { border-color:#89b4fa; }
        .ep-provider-info { font-size:10px; color:#6c7086; }
        .ep-preview { background:#181825; border:1px solid #313244; border-radius:4px; padding:6px; }
        .ep-preview-img { max-width:100%; border-radius:2px; }
        .ep-replace-section { display:flex; flex-direction:column; gap:4px; }
        .ep-btn-replace {
          background:#313244; border:1px solid #45475a; color:#cdd6f4;
          border-radius:4px; padding:5px 8px; font-size:11px; cursor:pointer; width:100%;
        }
        .ep-btn-replace:hover:not(:disabled) { background:#45475a; }
        .ep-btn-replace:disabled { opacity:.4; cursor:not-allowed; }
        .ep-save-section { display:flex; flex-direction:column; gap:6px; }
        .ep-save-tabs { display:flex; gap:2px; }
        .ep-save-tab {
          flex:1; background:#313244; border:1px solid #45475a; color:#a6adc8;
          border-radius:4px; padding:4px 0; font-size:11px; cursor:pointer;
        }
        .ep-save-tab.active { background:#89b4fa; border-color:#89b4fa; color:#1e1e2e; font-weight:600; }
        .ep-select {
          background:#313244; border:1px solid #45475a; border-radius:4px;
          color:#cdd6f4; font-size:12px; padding:5px 8px; width:100%;
        }
        .ep-btn-save {
          background:#a6e3a1; color:#1e1e2e; border:none; border-radius:4px;
          padding:6px 10px; font-size:12px; font-weight:600; cursor:pointer; width:100%;
        }
        .ep-btn-save:disabled { opacity:.45; cursor:not-allowed; }
        .ep-save-ok { color:#a6e3a1; font-size:11px; }
      `}</style>
    </div>
  );
}
