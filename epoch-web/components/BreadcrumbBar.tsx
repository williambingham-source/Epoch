'use client';

import Link from 'next/link';

interface Props {
  workspaceName: string;
  selectedPath: string | null;
  nodeTitle: string;
  onGoWorkspace?: () => void;
}

export default function BreadcrumbBar({ workspaceName, selectedPath, nodeTitle, onGoWorkspace }: Props) {
  const segments: string[] = [];

  if (selectedPath) {
    const parts = selectedPath.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      segments.push(parts[i]);
    }
    segments.push(nodeTitle || parts[parts.length - 1]);
  }

  return (
    <div className="breadcrumb-bar">
      <Link href="/" className="bc-home" title="All workspaces">⬡</Link>
      <span className="bc-sep" style={{ margin: '0 4px', fontSize: 11 }}>›</span>

      {onGoWorkspace && selectedPath ? (
        <button className="bc-workspace-btn" onClick={onGoWorkspace}>{workspaceName}</button>
      ) : (
        <span className="bc-workspace">{workspaceName}</span>
      )}

      {segments.map((seg, i) => (
        <span key={i} className="bc-segment">
          <span className="bc-sep">›</span>
          <span className={i === segments.length - 1 ? 'bc-current' : 'bc-ancestor'}>
            {seg}
          </span>
        </span>
      ))}
      <style>{`
        .breadcrumb-bar {
          display: flex;
          align-items: center;
          gap: 0;
          font-size: 12px;
          color: var(--text-muted);
          overflow: hidden;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
        .bc-home {
          color: var(--accent, #89b4fa);
          text-decoration: none;
          font-size: 16px;
          line-height: 1;
          flex-shrink: 0;
          transition: opacity 0.1s;
        }
        .bc-home:hover { opacity: 0.7; }
        .bc-workspace {
          color: var(--text-sub);
          font-weight: 500;
          flex-shrink: 0;
        }
        .bc-workspace-btn {
          background: none;
          border: none;
          padding: 0;
          color: var(--text-sub);
          font-weight: 500;
          font-size: 12px;
          cursor: pointer;
          flex-shrink: 0;
          transition: color 0.1s;
        }
        .bc-workspace-btn:hover { color: var(--accent, #89b4fa); }
        .bc-segment {
          display: inline-flex;
          align-items: center;
          min-width: 0;
          overflow: hidden;
        }
        .bc-sep {
          margin: 0 4px;
          color: var(--text-muted);
          flex-shrink: 0;
          font-size: 11px;
        }
        .bc-ancestor {
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 80px;
        }
        .bc-current {
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
      `}</style>
    </div>
  );
}
