import React, { useRef, useState } from 'react';
import type { NodeEntry } from '../types.js';

interface Props {
  parentPath: string | null;
  children: NodeEntry[];
  onNavigate: (path: string) => void;
  onAdd: (parentPath: string | null, title: string) => void;
}

export function ChildList({ parentPath, children, onNavigate, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startAdd = () => {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirm = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(parentPath, trimmed);
    setTitle('');
    setAdding(false);
  };

  const cancel = () => {
    setTitle('');
    setAdding(false);
  };

  return (
    <>
      <div className="sidebar-header">
        <span>{parentPath ? 'Children' : 'Top-level nodes'}</span>
        {!adding && (
          <button className="btn icon" onClick={startAdd} title="Add node">
            +
          </button>
        )}
      </div>

      {adding && (
        <div className="add-child-form">
          <input
            ref={inputRef}
            placeholder="Node title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
              if (e.key === 'Escape') cancel();
            }}
          />
          <div className="add-child-actions">
            <button className="btn" onClick={confirm} disabled={!title.trim()}>
              Add
            </button>
            <button className="btn secondary" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {children.length === 0 && !adding && (
        <p className="muted" style={{ padding: '12px 14px' }}>
          No nodes here yet.
        </p>
      )}

      {children.map((entry) => (
        <div
          key={entry.path}
          className="node-card"
          onClick={() => onNavigate(entry.path)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate(entry.path)}
        >
          <span className="node-card-title">{entry.node.title}</span>
          <span
            className={`status-badge status-${entry.node.status.toLowerCase()}`}
          >
            {entry.node.status}
          </span>
        </div>
      ))}
    </>
  );
}
