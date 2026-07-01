import React from 'react';
import type { Manifest, NodeEntry } from '../types.js';

interface Props {
  manifest: Manifest;
  ancestors: NodeEntry[];
  currentEntry: NodeEntry | null;
  onNavigate: (path: string | null) => void;
}

export function BreadcrumbBar({ manifest, ancestors, currentEntry, onNavigate }: Props) {
  return (
    <div className="epoch-breadcrumb">
      <button className="epoch-breadcrumb-item" onClick={() => onNavigate(null)}>
        {manifest.name}
      </button>

      {ancestors.map((a) => (
        <React.Fragment key={a.path}>
          <span className="epoch-breadcrumb-sep">›</span>
          <button className="epoch-breadcrumb-item" onClick={() => onNavigate(a.path)}>
            {a.node.title}
          </button>
        </React.Fragment>
      ))}

      {currentEntry && (
        <>
          <span className="epoch-breadcrumb-sep">›</span>
          <span className="epoch-breadcrumb-item current">{currentEntry.node.title}</span>
        </>
      )}
    </div>
  );
}
