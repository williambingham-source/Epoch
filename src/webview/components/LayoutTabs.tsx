import React from 'react';
import type { LayoutMode } from '../layoutProps.js';

const TABS: { mode: LayoutMode; label: string; title: string }[] = [
  { mode: 'analytical', label: 'Analytical', title: 'A — 3-column: tree | editor | context' },
  { mode: 'focus',      label: 'Focus',      title: "B — Writer's focus with bottom drawer" },
  { mode: 'navigator',  label: 'Navigator',  title: 'C — Spatial card grid' },
];

export function LayoutTabs({
  mode,
  onChange,
}: {
  mode: LayoutMode;
  onChange: (m: LayoutMode) => void;
}) {
  return (
    <div className="layout-tabs">
      {TABS.map((t) => (
        <button
          key={t.mode}
          className={`layout-tab${mode === t.mode ? ' active' : ''}`}
          onClick={() => onChange(t.mode)}
          title={t.title}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
