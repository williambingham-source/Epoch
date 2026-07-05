'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listWorkspaces, createWorkspace } from '@/lib/api';
import type { WorkspaceSummary } from '@/lib/api';

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

const STATUS_PALETTE = ['#89b4fa', '#a6e3a1', '#f9a95a', '#cba6f7', '#89dceb'];

export default function WorkspaceHome() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDisplay, setFormDisplay] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ws = await listWorkspaces();
      setWorkspaces(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) { setFormError('Name is required'); return; }
    setSubmitting(true);
    try {
      await createWorkspace(formName.trim(), formDisplay.trim() || formName.trim(), formDesc.trim() || undefined);
      setCreating(false);
      setFormName(''); setFormDisplay(''); setFormDesc('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wh-root">
      <div className="wh-header">
        <div className="wh-logo">
          <span className="wh-logo-mark">⬡</span>
          <span className="wh-logo-text">Epoch</span>
        </div>
        <button className="wh-new-btn" onClick={() => setCreating(true)}>
          + New Workspace
        </button>
      </div>

      <div className="wh-body">
        {loading && (
          <p className="wh-muted">Loading workspaces…</p>
        )}

        {!loading && error && (
          <div className="wh-error">
            <strong>Bridge unreachable</strong>
            <p>{error}</p>
            <button className="wh-retry" onClick={load}>Retry</button>
          </div>
        )}

        {!loading && !error && workspaces.length === 0 && (
          <div className="wh-empty">
            <div className="wh-empty-icon">⬡</div>
            <p>No workspaces found.</p>
            <button className="wh-new-btn" onClick={() => setCreating(true)}>
              Create your first workspace
            </button>
          </div>
        )}

        {!loading && !error && workspaces.length > 0 && (
          <div className="wh-grid">
            {workspaces.map((ws, i) => (
              <button
                key={ws.name}
                className="wh-card"
                onClick={() => router.push(`/ws/${ws.name}`)}
              >
                <div
                  className="wh-card-stripe"
                  style={{ background: STATUS_PALETTE[i % STATUS_PALETTE.length] }}
                />
                <div className="wh-card-body">
                  <div className="wh-card-title">{ws.displayName}</div>
                  {ws.description && (
                    <div className="wh-card-desc">{ws.description}</div>
                  )}
                  <div className="wh-card-meta">
                    <span className="wh-badge">{ws.nodeCount} node{ws.nodeCount !== 1 ? 's' : ''}</span>
                    <span className="wh-muted">{relativeTime(ws.updatedAt)}</span>
                  </div>
                  <div className="wh-card-slug">{ws.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create workspace modal */}
      {creating && (
        <div className="wh-overlay" onClick={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="wh-modal">
            <div className="wh-modal-header">
              <span>New Workspace</span>
              <button className="wh-modal-close" onClick={() => setCreating(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="wh-form">
              <label className="wh-label">
                Folder name
                <input
                  className="wh-input"
                  placeholder="my-workspace"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  pattern="[a-zA-Z0-9_-]+"
                  title="Letters, numbers, hyphens, underscores only"
                  required
                  autoFocus
                />
                <span className="wh-hint">Used in the URL — letters, numbers, hyphens only</span>
              </label>
              <label className="wh-label">
                Display name
                <input
                  className="wh-input"
                  placeholder="My Workspace"
                  value={formDisplay}
                  onChange={(e) => setFormDisplay(e.target.value)}
                />
              </label>
              <label className="wh-label">
                Description
                <input
                  className="wh-input"
                  placeholder="Optional description"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </label>
              {formError && <div className="wh-form-error">{formError}</div>}
              <div className="wh-form-actions">
                <button type="button" className="wh-btn-secondary" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button type="submit" className="wh-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .wh-root {
          min-height: 100vh;
          background: var(--bg, #1e1e2e);
          color: var(--text, #cdd6f4);
          display: flex;
          flex-direction: column;
        }
        .wh-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 56px;
          border-bottom: 1px solid var(--border, #313244);
          background: var(--surface, #181825);
          flex-shrink: 0;
        }
        .wh-logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .wh-logo-mark {
          font-size: 20px;
          color: var(--accent, #89b4fa);
        }
        .wh-logo-text {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.03em;
          color: var(--text, #cdd6f4);
        }
        .wh-new-btn {
          background: var(--accent, #89b4fa);
          color: var(--bg, #1e1e2e);
          border: none;
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .wh-new-btn:hover { opacity: 0.88; }

        .wh-body {
          flex: 1;
          padding: 40px 32px;
          max-width: 960px;
          margin: 0 auto;
          width: 100%;
        }
        .wh-muted {
          color: var(--text-muted, #6c7086);
          font-size: 13px;
        }
        .wh-error {
          background: color-mix(in srgb, #f38ba8 12%, transparent);
          border: 1px solid color-mix(in srgb, #f38ba8 40%, transparent);
          border-radius: 8px;
          padding: 20px 24px;
          color: #f38ba8;
        }
        .wh-error p { margin: 6px 0 12px; font-size: 13px; opacity: 0.8; }
        .wh-retry {
          background: none;
          border: 1px solid #f38ba8;
          color: #f38ba8;
          border-radius: 4px;
          padding: 4px 12px;
          font-size: 12px;
          cursor: pointer;
        }
        .wh-empty {
          text-align: center;
          padding: 80px 0;
        }
        .wh-empty-icon {
          font-size: 48px;
          color: var(--border, #313244);
          margin-bottom: 16px;
        }
        .wh-empty p {
          color: var(--text-muted, #6c7086);
          margin-bottom: 20px;
          font-size: 14px;
        }

        .wh-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .wh-card {
          display: flex;
          background: var(--surface, #181825);
          border: 1px solid var(--border, #313244);
          border-radius: 8px;
          overflow: hidden;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.12s, box-shadow 0.12s, transform 0.1s;
          padding: 0;
          min-height: 110px;
        }
        .wh-card:hover {
          border-color: var(--accent, #89b4fa);
          box-shadow: 0 4px 16px rgba(0,0,0,0.35);
          transform: translateY(-1px);
        }
        .wh-card-stripe {
          width: 5px;
          flex-shrink: 0;
        }
        .wh-card-body {
          flex: 1;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }
        .wh-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text, #cdd6f4);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wh-card-desc {
          font-size: 12px;
          color: var(--text-sub, #a6adc8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wh-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .wh-badge {
          font-size: 11px;
          background: var(--surface2, #313244);
          color: var(--text-sub, #a6adc8);
          border-radius: 4px;
          padding: 1px 6px;
        }
        .wh-card-slug {
          font-size: 10px;
          color: var(--text-muted, #6c7086);
          font-family: monospace;
          margin-top: auto;
        }

        /* Modal */
        .wh-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .wh-modal {
          background: var(--surface, #181825);
          border: 1px solid var(--border, #313244);
          border-radius: 10px;
          width: 420px;
          max-width: 94vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .wh-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border, #313244);
          font-weight: 600;
          font-size: 14px;
        }
        .wh-modal-close {
          background: none;
          border: none;
          color: var(--text-muted, #6c7086);
          font-size: 16px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .wh-modal-close:hover { color: var(--text, #cdd6f4); }
        .wh-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .wh-label {
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-sub, #a6adc8);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .wh-input {
          background: var(--surface2, #313244);
          border: 1px solid var(--border, #45475a);
          border-radius: 5px;
          color: var(--text, #cdd6f4);
          font-size: 13px;
          padding: 7px 10px;
          outline: none;
          transition: border-color 0.12s;
        }
        .wh-input:focus { border-color: var(--accent, #89b4fa); }
        .wh-hint {
          font-size: 11px;
          color: var(--text-muted, #6c7086);
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
        }
        .wh-form-error {
          font-size: 12px;
          color: #f38ba8;
          background: color-mix(in srgb, #f38ba8 10%, transparent);
          border: 1px solid color-mix(in srgb, #f38ba8 30%, transparent);
          border-radius: 4px;
          padding: 6px 10px;
        }
        .wh-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 4px;
        }
        .wh-btn-secondary {
          background: var(--surface2, #313244);
          border: 1px solid var(--border, #45475a);
          color: var(--text-sub, #a6adc8);
          border-radius: 5px;
          padding: 7px 14px;
          font-size: 13px;
          cursor: pointer;
        }
        .wh-btn-secondary:hover { color: var(--text, #cdd6f4); }
        .wh-btn-primary {
          background: var(--accent, #89b4fa);
          color: var(--bg, #1e1e2e);
          border: none;
          border-radius: 5px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .wh-btn-primary:hover { opacity: 0.88; }
        .wh-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
