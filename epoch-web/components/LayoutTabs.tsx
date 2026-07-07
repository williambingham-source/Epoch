'use client';

import type { LayoutMode } from '@/layouts/types';

interface Props {
  mode: LayoutMode;
  onChange: (m: LayoutMode) => void;
}

const MODES: { id: LayoutMode; label: string; title: string }[] = [
  { id: 'analytical', label: 'Analytical', title: 'Analytical — 3-column' },
  { id: 'focus',      label: 'Focus',      title: 'Focus — centered editor' },
  { id: 'navigator',  label: 'Navigator',  title: 'Navigator — card grid' },
];

export default function LayoutTabs({ mode, onChange }: Props) {
  return (
    <div className="layout-tabs">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`lt-btn${mode === m.id ? ' active' : ''}`}
          onClick={() => onChange(m.id)}
          title={m.title}
        >
          {m.label}
        </button>
      ))}
      <style>{`
        .layout-tabs {
          display: flex;
          align-items: center;
          gap: 1px;
        }
        .lt-btn {
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--text-muted);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 0 8px;
          border: 1px solid transparent;
          position: relative;
          white-space: nowrap;
        }
        .lt-btn:hover { color: var(--text); background: var(--surface2); }
        .lt-btn.active {
          color: var(--accent);
          background: var(--surface2);
          border-color: var(--accent-dim);
        }
        .lt-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 4px;
          right: 4px;
          height: 2px;
          background: var(--accent);
          border-radius: 1px;
        }
      `}</style>
    </div>
  );
}
