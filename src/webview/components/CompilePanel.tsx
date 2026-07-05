import React from 'react';
import type { CompileResult } from '../types.js';

interface Props {
  workspaceDir: string;
  compiling: boolean;
  result: CompileResult | null;
  hasPdf: boolean;
  viewMode: 'edit' | 'pdf' | 'history';
  onCompile: () => void;
  onToggleView: () => void;
}

export function CompilePanel({
  workspaceDir: _,
  compiling,
  result,
  hasPdf,
  viewMode,
  onCompile,
  onToggleView,
}: Props) {
  return (
    <div className="epoch-compile-bar">
      <button className="btn" onClick={onCompile} disabled={compiling}>
        {compiling ? 'Compiling…' : '⬡ Compile Workspace'}
      </button>

      {hasPdf && (
        <button className="btn secondary" onClick={onToggleView}>
          {viewMode === 'pdf' ? '✎ Edit' : '⊞ View PDF'}
        </button>
      )}

      {result && (() => {
        const errRaw = result.errors[0] ?? 'Compilation failed';
        // Take only the first non-empty line and cap at 120 chars so the bar stays compact
        const firstLine = errRaw.split('\n').find((l) => l.trim()) ?? 'Compilation failed';
        const errText = firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine;
        return (
          <span
            className={`compile-status ${result.success ? 'success' : 'error'}`}
            title={result.success ? undefined : errRaw}
          >
            {result.success ? '✓ PDF compiled' : `✗ ${errText}`}
          </span>
        );
      })()}
    </div>
  );
}
