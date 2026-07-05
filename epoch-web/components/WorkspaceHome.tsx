'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  listWorkspaces,
  createWorkspace,
  listGiteaRepos,
  cloneFromGitea,
  pushWorkspaceSync,
  pullWorkspaceSync,
} from '@/lib/api';
import type { WorkspaceSummary, GiteaRepo, SyncResult } from '@/lib/api';

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

const ACCENT_PALETTE = ['#89b4fa', '#a6e3a1', '#f9a95a', '#cba6f7', '#89dceb', '#f38ba8'];

type SyncState = { busy: boolean; result: SyncResult | null };

export default function WorkspaceHome() {
  const router = useRouter();

  // Local workspaces
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Gitea repos
  const [giteaRepos, setGiteaRepos] = useState<GiteaRepo[]>([]);
  const [giteaLoading, setGiteaLoading] = useState(true);
  const [giteaError, setGiteaError] = useState<string | null>(null);

  // Per-workspace sync state
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});

  // Clone state
  const [cloning, setCloning] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDisplay, setFormDisplay] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formGitea, setFormGitea] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadLocal = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setWorkspaces(await listWorkspaces());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGitea = useCallback(async () => {
    setGiteaLoading(true);
    setGiteaError(null);
    try {
      setGiteaRepos(await listGiteaRepos());
    } catch (err) {
      setGiteaError(err instanceof Error ? err.message : 'Gitea unreachable');
    } finally {
      setGiteaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocal();
    loadGitea();
  }, [loadLocal, loadGitea]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) { setFormError('Name is required'); return; }
    setSubmitting(true);
    try {
      await createWorkspace(
        formName.trim(),
        formDisplay.trim() || formName.trim(),
        formDesc.trim() || undefined,
        formGitea,
      );
      setCreating(false);
      setFormName(''); setFormDisplay(''); setFormDesc(''); setFormGitea(false);
      await Promise.all([loadLocal(), loadGitea()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClone(name: string) {
    setCloning(name);
    setCloneError(null);
    try {
      await cloneFromGitea(name);
      await Promise.all([loadLocal(), loadGitea()]);
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setCloning(null);
    }
  }

  async function handlePush(name: string) {
    setSyncStates((s) => ({ ...s, [name]: { busy: true, result: null } }));
    const result = await pushWorkspaceSync(name).catch((err) => ({
      success: false,
      message: err instanceof Error ? err.message : 'Push failed',
    }));
    setSyncStates((s) => ({ ...s, [name]: { busy: false, result } }));
  }

  async function handlePull(name: string) {
    setSyncStates((s) => ({ ...s, [name]: { busy: true, result: null } }));
    const result = await pullWorkspaceSync(name).catch((err) => ({
      success: false,
      message: err instanceof Error ? err.message : 'Pull failed',
    }));
    setSyncStates((s) => ({ ...s, [name]: { busy: false, result } }));
  }

  // Gitea repos that are not yet cloned locally
  const unclonedRepos = giteaRepos.filter((r) => !r.isCloned);

  return (
    <div className="wh-root">
      {/* ── Header ── */}
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

        {/* ── Local workspaces ── */}
        <div className="wh-section-label">Local Workspaces</div>

        {loading && <p className="wh-muted">Loading…</p>}

        {!loading && loadError && (
          <div className="wh-error">
            <strong>Bridge unreachable</strong>
            <p>{loadError}</p>
            <button className="wh-retry" onClick={loadLocal}>Retry</button>
          </div>
        )}

        {!loading && !loadError && workspaces.length === 0 && (
          <div className="wh-empty">
            <div className="wh-empty-icon">⬡</div>
            <p>No local workspaces found.</p>
            <button className="wh-new-btn" onClick={() => setCreating(true)}>
              Create your first workspace
            </button>
          </div>
        )}

        {!loading && !loadError && workspaces.length > 0 && (
          <div className="wh-grid">
            {workspaces.map((ws, i) => {
              const sync = syncStates[ws.name];
              return (
                <div key={ws.name} className="wh-card">
                  <div
                    className="wh-card-stripe"
                    style={{ background: ACCENT_PALETTE[i % ACCENT_PALETTE.length] }}
                  />
                  <div className="wh-card-body">
                    <button
                      className="wh-card-link"
                      onClick={() => router.push(`/ws/${ws.name}`)}
                    >
                      <div className="wh-card-title">{ws.displayName}</div>
                      {ws.description && (
                        <div className="wh-card-desc">{ws.description}</div>
                      )}
                      <div className="wh-card-meta">
                        <span className="wh-badge">
                          {ws.nodeCount} node{ws.nodeCount !== 1 ? 's' : ''}
                        </span>
                        {ws.hasRemote && (
                          <span className="wh-badge wh-badge-remote">⎇ git</span>
                        )}
                        <span className="wh-muted">{relativeTime(ws.updatedAt)}</span>
                      </div>
                      <div className="wh-card-slug">{ws.name}</div>
                    </button>

                    {ws.hasRemote && (
                      <div className="wh-card-sync">
                        {sync?.result && (
                          <span
                            className={`wh-sync-msg ${sync.result.success ? 'ok' : 'err'}`}
                            title={sync.result.details}
                          >
                            {sync.result.success ? '✓' : '✗'} {sync.result.message}
                          </span>
                        )}
                        <button
                          className="wh-sync-btn"
                          onClick={() => handlePull(ws.name)}
                          disabled={sync?.busy}
                          title="Pull from remote"
                        >
                          {sync?.busy ? '…' : '↓ Pull'}
                        </button>
                        <button
                          className="wh-sync-btn"
                          onClick={() => handlePush(ws.name)}
                          disabled={sync?.busy}
                          title="Push to remote"
                        >
                          {sync?.busy ? '…' : '↑ Push'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Gitea repos ── */}
        <div className="wh-section-label" style={{ marginTop: 36 }}>
          From Gitea
          {!giteaLoading && !giteaError && (
            <span className="wh-section-count">
              {unclonedRepos.length} not yet cloned
            </span>
          )}
        </div>

        {giteaLoading && <p className="wh-muted">Connecting to Gitea…</p>}

        {!giteaLoading && giteaError && (
          <div className="wh-error wh-error-sm">
            Gitea not reachable — {giteaError}
            <button className="wh-retry" style={{ marginLeft: 8 }} onClick={loadGitea}>Retry</button>
          </div>
        )}

        {!giteaLoading && !giteaError && unclonedRepos.length === 0 && (
          <p className="wh-muted">All Gitea repos are already cloned locally.</p>
        )}

        {cloneError && (
          <div className="wh-error wh-error-sm" style={{ marginBottom: 10 }}>
            Clone failed: {cloneError}
          </div>
        )}

        {!giteaLoading && !giteaError && unclonedRepos.length > 0 && (
          <div className="wh-grid">
            {unclonedRepos.map((repo) => (
              <div key={repo.name} className="wh-card wh-card-gitea">
                <div className="wh-card-stripe" style={{ background: '#45475a' }} />
                <div className="wh-card-body">
                  <div className="wh-card-title">{repo.name}</div>
                  {repo.description && (
                    <div className="wh-card-desc">{repo.description}</div>
                  )}
                  <div className="wh-card-meta">
                    <span className="wh-badge">Gitea</span>
                    <span className="wh-muted">{relativeTime(repo.updatedAt)}</span>
                  </div>
                  <div className="wh-card-sync">
                    <button
                      className="wh-sync-btn wh-clone-btn"
                      onClick={() => handleClone(repo.name)}
                      disabled={cloning === repo.name}
                    >
                      {cloning === repo.name ? 'Cloning…' : '⬇ Clone'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create workspace modal ── */}
      {creating && (
        <div
          className="wh-overlay"
          onClick={(e) => e.target === e.currentTarget && setCreating(false)}
        >
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
                  placeholder="Optional"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </label>
              <label className="wh-label wh-label-check">
                <input
                  type="checkbox"
                  checked={formGitea}
                  onChange={(e) => setFormGitea(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent, #89b4fa)' }}
                />
                Also create Gitea repo and push initial commit
              </label>
              {formError && <div className="wh-form-error">{formError}</div>}
              <div className="wh-form-actions">
                <button
                  type="button"
                  className="wh-btn-secondary"
                  onClick={() => setCreating(false)}
                >
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
        .wh-logo { display: flex; align-items: center; gap: 8px; }
        .wh-logo-mark { font-size: 20px; color: var(--accent, #89b4fa); }
        .wh-logo-text { font-size: 16px; font-weight: 600; letter-spacing: 0.03em; }
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
          padding: 32px;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }
        .wh-section-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted, #6c7086);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .wh-section-count {
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          font-size: 11px;
          color: var(--text-muted, #6c7086);
        }
        .wh-muted { color: var(--text-muted, #6c7086); font-size: 13px; }
        .wh-error {
          background: color-mix(in srgb, #f38ba8 12%, transparent);
          border: 1px solid color-mix(in srgb, #f38ba8 40%, transparent);
          border-radius: 8px;
          padding: 16px 20px;
          color: #f38ba8;
          font-size: 13px;
        }
        .wh-error-sm { padding: 8px 12px; border-radius: 5px; }
        .wh-error p { margin: 4px 0 10px; font-size: 13px; opacity: 0.8; }
        .wh-retry {
          background: none;
          border: 1px solid currentColor;
          color: inherit;
          border-radius: 4px;
          padding: 2px 10px;
          font-size: 11px;
          cursor: pointer;
        }
        .wh-empty { text-align: center; padding: 60px 0; }
        .wh-empty-icon { font-size: 40px; color: var(--border, #313244); margin-bottom: 12px; }
        .wh-empty p { color: var(--text-muted, #6c7086); margin-bottom: 16px; font-size: 14px; }

        .wh-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .wh-card {
          display: flex;
          background: var(--surface, #181825);
          border: 1px solid var(--border, #313244);
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .wh-card:hover { border-color: var(--surface3, #585b70); }
        .wh-card-gitea { opacity: 0.75; }
        .wh-card-stripe { width: 5px; flex-shrink: 0; }
        .wh-card-body {
          flex: 1;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 0;
          min-width: 0;
        }
        .wh-card-link {
          background: none;
          border: none;
          padding: 0;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
          min-width: 0;
        }
        .wh-card-link:hover .wh-card-title { color: var(--accent, #89b4fa); }
        .wh-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text, #cdd6f4);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.1s;
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
          gap: 6px;
          margin-top: 6px;
        }
        .wh-badge {
          font-size: 11px;
          background: var(--surface2, #313244);
          color: var(--text-sub, #a6adc8);
          border-radius: 4px;
          padding: 1px 6px;
        }
        .wh-badge-remote {
          color: var(--accent, #89b4fa);
          background: color-mix(in srgb, #89b4fa 12%, transparent);
        }
        .wh-card-slug {
          font-size: 10px;
          color: var(--text-muted, #6c7086);
          font-family: monospace;
          margin-top: 4px;
        }
        .wh-card-sync {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--border, #313244);
        }
        .wh-sync-msg {
          font-size: 11px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wh-sync-msg.ok { color: #a6e3a1; }
        .wh-sync-msg.err { color: #f38ba8; }
        .wh-sync-btn {
          background: var(--surface2, #313244);
          border: 1px solid var(--border, #45475a);
          color: var(--text-sub, #a6adc8);
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
          transition: color 0.1s;
        }
        .wh-sync-btn:hover:not(:disabled) { color: var(--text, #cdd6f4); }
        .wh-sync-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .wh-clone-btn {
          color: var(--accent, #89b4fa);
          border-color: color-mix(in srgb, #89b4fa 40%, transparent);
        }
        .wh-clone-btn:hover:not(:disabled) {
          background: color-mix(in srgb, #89b4fa 12%, transparent);
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
          line-height: 1;
        }
        .wh-modal-close:hover { color: var(--text, #cdd6f4); }
        .wh-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .wh-label {
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted, #6c7086);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .wh-label-check {
          flex-direction: row;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          text-transform: none;
          letter-spacing: 0;
          font-weight: 400;
          color: var(--text-sub, #a6adc8);
          cursor: pointer;
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
