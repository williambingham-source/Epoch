import React, { useState } from 'react';
import type { NodeEntry, ReviewRequest } from '../types.js';

const STATUS_DOT_COLOR: Record<string, string> = {
  Sketch:     'var(--vscode-descriptionForeground, #a6adc8)',
  Conjecture: '#89b4fa',
  Hypothesis: '#f9e2af',
  Theorem:    '#a6e3a1',
};

interface NodeTreeProps {
  nodes: NodeEntry[];
  currentPath: string | null;
  reviews: ReviewRequest[];
  workspaceTitle: string;
  onNavigate: (path: string | null) => void;
  onAdd: (parentPath: string | null, title: string) => void;
}

export function NodeTree({ nodes, currentPath, reviews, workspaceTitle, onNavigate, onAdd }: NodeTreeProps) {
  const [search, setSearch] = useState('');
  const [addingAt, setAddingAt] = useState<string | null>(null); // path | 'root'
  const [newTitle, setNewTitle] = useState('');

  const pendingPaths = new Set(
    reviews.filter((r) => r.status === 'pending').map((r) => r.nodePath),
  );

  const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path));

  const visible = search
    ? sorted.filter((n) => n.node.title.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  const depth = (path: string) => path.split('/').length - 1;

  const commitAdd = (parentPath: string | null) => {
    const t = newTitle.trim();
    if (!t) return;
    onAdd(parentPath, t);
    setNewTitle('');
    setAddingAt(null);
  };

  const cancelAdd = () => {
    setNewTitle('');
    setAddingAt(null);
  };

  return (
    <div className="node-tree">
      {/* Workspace root */}
      <div className="node-tree-header">
        <button
          className={`node-tree-ws${currentPath === null ? ' active' : ''}`}
          onClick={() => onNavigate(null)}
          title="Back to workspace root"
        >
          {workspaceTitle}
        </button>
        <button
          className="node-tree-add-root"
          title="Add top-level node"
          onClick={() => setAddingAt('root')}
        >
          +
        </button>
      </div>

      {/* Search */}
      <div className="node-tree-search">
        <input
          placeholder="Filter nodes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Add top-level form */}
      {addingAt === 'root' && (
        <div className="node-tree-add-form">
          <input
            autoFocus
            placeholder="Node title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd(null);
              if (e.key === 'Escape') cancelAdd();
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => commitAdd(null)}>
              Add
            </button>
            <button className="btn secondary" onClick={cancelAdd}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Node list */}
      <div className="node-tree-list">
        {visible.length === 0 && (
          <p className="muted" style={{ padding: '12px 14px', fontSize: '0.85em' }}>
            {search ? 'No matches.' : 'No nodes yet.'}
          </p>
        )}

        {visible.map((entry) => {
          const d = depth(entry.path);
          const isActive = entry.path === currentPath;
          const hasPending = pendingPaths.has(entry.path);
          const dotColor = STATUS_DOT_COLOR[entry.node.status] ?? '#888';

          return (
            <div
              key={entry.path}
              className={`node-tree-item${isActive ? ' active' : ''}`}
              style={{ paddingLeft: 12 + d * 14 }}
              onClick={() => onNavigate(entry.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onNavigate(entry.path)}
            >
              <span
                className="node-tree-dot"
                style={{ background: dotColor }}
                title={entry.node.status}
              />
              <span className="node-tree-name">{entry.node.title}</span>
              {hasPending && (
                <span className="node-tree-review-indicator" title="Review pending" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
