'use client';

import { useState, useEffect } from 'react';
import { getNodeLog } from '@/lib/api';
import type { CommitEntry } from '@/lib/api';

interface Props {
  nodePath: string | null;
}

function relativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GitLog({ nodePath }: Props) {
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCommits([]);
    getNodeLog(nodePath ?? '', 60)
      .then(setCommits)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [nodePath]);

  return (
    <div className="git-log">
      <div className="gl-header">
        <span className="gl-title">
          {nodePath ? 'Node History' : 'Workspace History'}
        </span>
        {!loading && !error && (
          <span className="gl-count">{commits.length} commit{commits.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading && <div className="gl-state">Loading history…</div>}
      {error && <div className="gl-state gl-error">{error}</div>}
      {!loading && !error && commits.length === 0 && (
        <div className="gl-state">No commits found</div>
      )}

      {commits.map((c) => (
        <div key={c.hash + c.timestamp} className="gl-row">
          <span className="gl-hash">{c.hash}</span>
          <span className="gl-message">{c.message}</span>
          <span className="gl-meta">
            <span className="gl-author">{c.author}</span>
            <span className="gl-time">{relativeTime(c.timestamp)}</span>
          </span>
        </div>
      ))}

      <style>{`
        .git-log {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          font-size: 12px;
          background: var(--bg);
        }
        .gl-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
        }
        .gl-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .gl-count {
          font-size: 11px;
          color: var(--text-muted);
        }
        .gl-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
          padding: 24px;
        }
        .gl-error { color: var(--error); }
        .gl-row {
          display: grid;
          grid-template-columns: 52px 1fr;
          grid-template-rows: auto auto;
          padding: 8px 14px;
          border-bottom: 1px solid var(--border);
          gap: 1px 10px;
          transition: background 0.1s;
          overflow-y: auto;
        }
        .gl-row:hover { background: var(--surface); }
        .gl-hash {
          grid-row: 1 / 3;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent);
          align-self: center;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }
        .gl-message {
          color: var(--text);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gl-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        .gl-author {
          color: var(--text-muted);
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gl-time {
          color: var(--overlay);
          font-size: 11px;
          white-space: nowrap;
          flex-shrink: 0;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}
