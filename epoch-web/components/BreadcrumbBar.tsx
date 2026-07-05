'use client';

interface Props {
  workspaceName: string;
  selectedPath: string | null;
  nodeTitle: string;
}

export default function BreadcrumbBar({ workspaceName, selectedPath, nodeTitle }: Props) {
  const segments: string[] = [];

  if (selectedPath) {
    const parts = selectedPath.split('/');
    // Show intermediate slugs + final node title
    for (let i = 0; i < parts.length - 1; i++) {
      segments.push(parts[i]);
    }
    segments.push(nodeTitle || parts[parts.length - 1]);
  }

  return (
    <div className="breadcrumb-bar">
      <span className="bc-workspace">{workspaceName}</span>
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
        .bc-workspace {
          color: var(--text-sub);
          font-weight: 500;
          flex-shrink: 0;
        }
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
