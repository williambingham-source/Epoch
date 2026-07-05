'use client';

export type SidebarMode = 'nodes' | 'files';

interface Props {
  sidebarMode: SidebarMode;
  panelOpen: boolean;
  onSidebarMode: (m: SidebarMode) => void;
  onTogglePanel: () => void;
}

export default function ActivityBar({ sidebarMode, panelOpen, onSidebarMode, onTogglePanel }: Props) {
  function handleClick(m: SidebarMode) {
    if (sidebarMode === m) {
      onTogglePanel();
    } else {
      onSidebarMode(m);
      if (!panelOpen) onTogglePanel();
    }
  }

  const nodesActive = sidebarMode === 'nodes' && panelOpen;
  const filesActive = sidebarMode === 'files' && panelOpen;

  return (
    <div className="activity-bar">
      <button
        className={`ab-btn${nodesActive ? ' active' : ''}`}
        onClick={() => handleClick('nodes')}
        title="Node Explorer (E)"
      >
        {/* tree / hierarchy icon */}
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="5" height="4" rx="1"/>
          <rect x="8" y="7" width="5" height="4" rx="1"/>
          <rect x="8" y="14" width="5" height="4" rx="1"/>
          <line x1="3.5" y1="5" x2="3.5" y2="9"/>
          <line x1="3.5" y1="9" x2="8" y2="9"/>
          <line x1="3.5" y1="9" x2="3.5" y2="16"/>
          <line x1="3.5" y1="16" x2="8" y2="16"/>
        </svg>
      </button>

      <button
        className={`ab-btn${filesActive ? ' active' : ''}`}
        onClick={() => handleClick('files')}
        title="File Explorer (F)"
      >
        {/* folder icon */}
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5H8l1.5 2H16.5A1.5 1.5 0 0 1 18 8.5v7A1.5 1.5 0 0 1 16.5 17h-13A1.5 1.5 0 0 1 2 15.5V6.5z"/>
        </svg>
      </button>

      <style>{`
        .activity-bar {
          width: var(--activity-bar-width);
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 4px;
          gap: 1px;
          flex-shrink: 0;
          z-index: 10;
        }
        .ab-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--text-muted);
          border-radius: 6px;
          padding: 0;
          position: relative;
          transition: color 0.12s, background 0.12s;
        }
        .ab-btn:hover {
          color: var(--text);
          background: var(--surface2);
        }
        .ab-btn.active {
          color: var(--text);
          background: var(--surface2);
        }
        .ab-btn.active::before {
          content: '';
          position: absolute;
          left: -1px;
          top: 6px;
          bottom: 6px;
          width: 2px;
          background: var(--accent);
          border-radius: 0 2px 2px 0;
        }
      `}</style>
    </div>
  );
}
