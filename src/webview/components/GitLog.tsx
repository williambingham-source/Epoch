import React from 'react';
import type { CommitEntry } from '../types.js';

function relativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface Props {
  nodePath: string | null;
  commits: CommitEntry[];
  loading: boolean;
  error: string | null;
}

export function GitLog({ nodePath, commits, loading, error }: Props) {
  return (
    <div className="git-log">
      <div className="gl-header">
        <span className="gl-title">
          {nodePath ? 'Node History' : 'Workspace History'}
        </span>
        {!loading && !error && (
          <span className="muted" style={{ fontSize: '0.82em' }}>
            {commits.length} commit{commits.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && <div className="gl-state muted">Loading history…</div>}
      {error && <div className="gl-state" style={{ color: 'var(--vscode-errorForeground)' }}>{error}</div>}
      {!loading && !error && commits.length === 0 && (
        <div className="gl-state muted">No commits found</div>
      )}

      <div className="gl-list">
        {commits.map((c) => (
          <div key={c.hash + c.timestamp} className="gl-row">
            <span className="gl-hash">{c.hash}</span>
            <div className="gl-body">
              <span className="gl-message">{c.message}</span>
              <span className="gl-meta">
                <span className="muted">{c.author}</span>
                <span className="muted">{relativeTime(c.timestamp)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
