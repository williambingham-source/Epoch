import React, { useState } from 'react';
import type { LayoutMode } from '../layoutProps.js';
import { QrModal } from './QrModal.js';

const TABS: { mode: LayoutMode; label: string; title: string }[] = [
  { mode: 'analytical', label: 'Analytical', title: 'A — 3-column: tree | editor | context' },
  { mode: 'focus',      label: 'Focus',      title: "B — Writer's focus with bottom drawer" },
  { mode: 'navigator',  label: 'Navigator',  title: 'C — Spatial card grid' },
];

export function LayoutTabs({
  mode,
  onChange,
  canvasUrl,
}: {
  mode: LayoutMode;
  onChange: (m: LayoutMode) => void;
  canvasUrl?: string;
}) {
  const [showQr, setShowQr] = useState(false);

  return (
    <>
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
        {canvasUrl && (
          <button
            className="layout-tab qr-trigger"
            onClick={() => setShowQr(true)}
            title={`Open canvas on device: ${canvasUrl}`}
          >
            📱
          </button>
        )}
      </div>
      {showQr && canvasUrl && (
        <QrModal url={canvasUrl} onClose={() => setShowQr(false)} />
      )}
    </>
  );
}
