import React from 'react';
import type { CompileResult } from '../types.js';

interface Props {
  workspaceDir: string;
  compiling: boolean;
  result: CompileResult | null;
  hasPdf: boolean;
  viewMode: 'edit' | 'pdf';
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

      {result && (
        <span className={`compile-status ${result.success ? 'success' : 'error'}`}>
          {result.success
            ? `✓ PDF compiled`
            : `✗ ${result.errors[0] ?? 'Compilation failed'}`}
        </span>
      )}
    </div>
  );
}
