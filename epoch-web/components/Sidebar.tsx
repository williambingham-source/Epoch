'use client';

import { useState, useRef } from 'react';
import { moveNode, updateNode } from '@/lib/api';
import type { NodeSummary } from '@/lib/api';

interface Props {
  nodes: NodeSummary[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onCreate: (parentPath: string, title: string) => Promise<void>;
  onRename?: (fromPath: string, toPath: string) => Promise<void>;
  workspaceName: string;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'node';
}

function statusColor(status: string): string {
  switch (status) {
    case 'Theorem':    return '#5dbf8a';
    case 'Hypothesis': return '#7c8fd6';
    case 'Conjecture': return '#f9a95a';
    default:           return '#8a87a8';
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
  renamingPath,
  renameTitle,
  onSelect,
  onCreateChild,
  onStartRename,
  onSetRenameTitle,
  onCommitRename,
  onCancelRename,
}: {
  path: string;
  map: Map<string, NodeSummary & { children: string[] }>;
  depth: number;
  selectedPath: string | null;
  renamingPath: string | null;
  renameTitle: string;
  onSelect: (p: string) => void;
  onCreateChild: (parentPath: string) => void;
  onStartRename: (p: string, currentTitle: string) => void;
  onSetRenameTitle: (t: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}) {
  const node = map.get(path);
  if (!node) return null;

  const isSelected = path === selectedPath;
  const isRenaming = path === renamingPath;

  return (
    <div>
      <div
        className={`sidebar-node${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => !isRenaming && onSelect(path)}
      >
        <span
          className="status-dot"
          style={{ background: statusColor(node.status) }}
          title={node.status}
        />

        {isRenaming ? (
          <input
            autoFocus
            className="rename-input"
            value={renameTitle}
            onChange={(e) => onSetRenameTitle(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); }
              if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="node-title"
            onDoubleClick={(e) => { e.stopPropagation(); onStartRename(path, node.title || path.split('/').pop() || ''); }}
            title="Double-click to rename"
          >
            {node.title || path.split('/').pop()}
          </span>
        )}

        {!isRenaming && (
          <button
            className="add-child-btn"
            title="Add child node"
            onClick={(e) => { e.stopPropagation(); onCreateChild(path); }}
          >
            +
          </button>
        )}
      </div>
      {node.children.map((childPath) => (
        <TreeNode
          key={childPath}
          path={childPath}
          map={map}
          depth={depth + 1}
          selectedPath={selectedPath}
          renamingPath={renamingPath}
          renameTitle={renameTitle}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onStartRename={onStartRename}
          onSetRenameTitle={onSetRenameTitle}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ nodes, selectedPath, onSelect, onCreate, onRename, workspaceName }: Props) {
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const renameLock = useRef(false);

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

  function startRename(path: string, currentTitle: string) {
    setRenamingPath(path);
    setRenameTitle(currentTitle);
    renameLock.current = false;
  }

  async function commitRename() {
    if (renameLock.current) return;
    renameLock.current = true;

    if (!renamingPath || !renameTitle.trim()) {
      setRenamingPath(null);
      return;
    }

    const originalNode = map.get(renamingPath);
    const originalTitle = originalNode?.title ?? '';
    const trimmed = renameTitle.trim();
    const parentPrefix = renamingPath.includes('/')
      ? renamingPath.slice(0, renamingPath.lastIndexOf('/'))
      : '';
    const newSlug = slugify(trimmed);
    const newPath = parentPrefix ? `${parentPrefix}/${newSlug}` : newSlug;

    // Nothing changed
    if (newPath === renamingPath && trimmed === originalTitle) {
      setRenamingPath(null);
      return;
    }

    setSaving(true);
    try {
      if (newPath !== renamingPath) {
        await moveNode(renamingPath, newPath);
      }
      await updateNode(newPath, undefined, trimmed);
      await onRename?.(renamingPath, newPath);
    } catch {
      // silent — node list refresh will restore state
    } finally {
      setSaving(false);
      setRenamingPath(null);
    }
  }

  function cancelRename() {
    setRenamingPath(null);
    setRenameTitle('');
    renameLock.current = false;
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
            renamingPath={renamingPath}
            renameTitle={renameTitle}
            onSelect={onSelect}
            onCreateChild={setCreatingUnder}
            onStartRename={startRename}
            onSetRenameTitle={setRenameTitle}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
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
        .rename-input {
          flex: 1;
          font-size: 13px;
          background: var(--surface2);
          border: 1px solid var(--accent);
          border-radius: 3px;
          color: var(--text);
          padding: 1px 5px;
          min-width: 0;
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
