'use client';

import { useState } from 'react';
import type { NodeSummary } from '@/lib/api';

interface Props {
  nodes: NodeSummary[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onCreate: (parentPath: string, title: string) => Promise<void>;
  workspaceName: string;
}

function statusColor(status: string): string {
  switch (status) {
    case 'verified': return '#5dbf8a';
    case 'in_progress': return '#7c8fd6';
    case 'disputed': return '#e06c75';
    default: return '#8a87a8';
  }
}

function buildTree(nodes: NodeSummary[]) {
  const map = new Map<string, NodeSummary & { children: string[] }>();
  const roots: string[] = [];

  for (const n of nodes) {
    map.set(n.path, { ...n, children: [] });
  }

  for (const n of nodes) {
    const lastSlash = n.path.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? n.path.slice(0, lastSlash) : null;
    if (parentPath && map.has(parentPath)) {
      map.get(parentPath)!.children.push(n.path);
    } else {
      roots.push(n.path);
    }
  }

  return { map, roots };
}

function TreeNode({
  path,
  map,
  depth,
  selectedPath,
  onSelect,
  onCreateChild,
}: {
  path: string;
  map: Map<string, NodeSummary & { children: string[] }>;
  depth: number;
  selectedPath: string | null;
  onSelect: (p: string) => void;
  onCreateChild: (parentPath: string) => void;
}) {
  const node = map.get(path);
  if (!node) return null;

  const isSelected = path === selectedPath;
  const title = node.path.split('/').pop() ?? node.title;

  return (
    <div>
      <div
        className={`sidebar-node${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(path)}
      >
        <span
          className="status-dot"
          style={{ background: statusColor(node.status) }}
          title={node.status}
        />
        <span className="node-title">{node.title || title}</span>
        <button
          className="add-child-btn"
          title="Add child node"
          onClick={(e) => { e.stopPropagation(); onCreateChild(path); }}
        >
          +
        </button>
      </div>
      {node.children.map((childPath) => (
        <TreeNode
          key={childPath}
          path={childPath}
          map={map}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ nodes, selectedPath, onSelect, onCreate, workspaceName }: Props) {
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const { map, roots } = buildTree(nodes);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || creatingUnder === null) return;
    setSaving(true);
    try {
      await onCreate(creatingUnder, newTitle.trim());
      setCreatingUnder(null);
      setNewTitle('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="workspace-name">{workspaceName}</span>
        <button className="add-root-btn" onClick={() => setCreatingUnder('')} title="New root node">+</button>
      </div>

      <div className="sidebar-tree">
        {roots.map((path) => (
          <TreeNode
            key={path}
            path={path}
            map={map}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onCreateChild={setCreatingUnder}
          />
        ))}
        {nodes.length === 0 && (
          <div className="sidebar-empty">No nodes yet. Click + to create one.</div>
        )}
      </div>

      {creatingUnder !== null && (
        <form className="create-form" onSubmit={handleCreate}>
          <div className="create-form-label">
            {creatingUnder ? `Under: ${creatingUnder.split('/').pop()}` : 'New root node'}
          </div>
          <input
            autoFocus
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setCreatingUnder(null)}
          />
          <div className="create-form-actions">
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setCreatingUnder(null)}>Cancel</button>
          </div>
        </form>
      )}

      <style>{`
        .sidebar {
          display: flex;
          flex-direction: column;
          width: 240px;
          min-width: 160px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          overflow: hidden;
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          gap: 8px;
        }
        .workspace-name {
          font-weight: 600;
          font-size: 13px;
          color: var(--accent);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .add-root-btn {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
          background: var(--accent-dim);
          color: var(--text);
          border-radius: 4px;
        }
        .add-root-btn:hover { background: var(--accent); }
        .sidebar-tree {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .sidebar-empty {
          padding: 12px;
          color: var(--text-muted);
          font-size: 12px;
        }
        .sidebar-node {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-top: 5px;
          padding-bottom: 5px;
          padding-right: 8px;
          cursor: pointer;
          border-radius: 4px;
          margin: 1px 4px;
          user-select: none;
        }
        .sidebar-node:hover { background: var(--surface2); }
        .sidebar-node.selected { background: var(--surface2); outline: 1px solid var(--accent-dim); }
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .node-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
        }
        .add-child-btn {
          opacity: 0;
          width: 18px;
          height: 18px;
          padding: 0;
          font-size: 14px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--accent-dim);
        }
        .sidebar-node:hover .add-child-btn { opacity: 1; }
        .add-child-btn:hover { background: var(--accent); }
        .create-form {
          padding: 10px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .create-form-label {
          font-size: 11px;
          color: var(--text-muted);
        }
        .create-form-actions {
          display: flex;
          gap: 6px;
        }
      `}</style>
    </aside>
  );
}
