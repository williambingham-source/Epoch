'use client';

import { useState, useRef, useEffect } from 'react';
import { updateNode, deleteNode } from '@/lib/api';

const STATUSES = ['Sketch', 'Conjecture', 'Hypothesis', 'Theorem'] as const;
type Status = typeof STATUSES[number];

const STATUS_COLOR: Record<Status, string> = {
  Sketch:     '#8a87a8',
  Conjecture: '#f9a95a',
  Hypothesis: '#7c8fd6',
  Theorem:    '#5dbf8a',
};

interface Props {
  path: string;
  title: string;
  status: string;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: string) => void;
  onDeleted: () => void;
}

export default function NodeHeader({ path, title, status, onTitleChange, onStatusChange, onDeleted }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync draft when title prop changes (new node selected)
  useEffect(() => {
    setDraftTitle(title);
    setEditingTitle(false);
  }, [title, path]);

  async function commitTitle() {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === title) {
      setEditingTitle(false);
      setDraftTitle(title);
      return;
    }
    setSaving(true);
    try {
      await updateNode(path, undefined, trimmed);
      onTitleChange(trimmed);
    } catch {
      setDraftTitle(title);
    } finally {
      setSaving(false);
      setEditingTitle(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      await updateNode(path, undefined, undefined, newStatus);
      onStatusChange(newStatus);
    } catch { /* silent — status reverts on next load */ }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteNode(path);
      onDeleted();
    } catch {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  const safeStatus = STATUSES.includes(status as Status) ? (status as Status) : 'Sketch';

  return (
    <div className="node-header">
      <div className="node-header-left">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="title-input"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') titleInputRef.current?.blur();
              if (e.key === 'Escape') { setDraftTitle(title); setEditingTitle(false); }
            }}
            autoFocus
            disabled={saving}
          />
        ) : (
          <span
            className="node-title"
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
          >
            {title || path}
          </span>
        )}

        <select
          className="status-select"
          value={safeStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{ color: STATUS_COLOR[safeStatus] }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} style={{ color: STATUS_COLOR[s] }}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="node-header-right">
        {confirmDelete ? (
          <>
            <span className="delete-confirm-label">Delete?</span>
            <button className="btn-danger" onClick={handleDelete} disabled={saving}>Yes</button>
            <button onClick={() => setConfirmDelete(false)}>No</button>
          </>
        ) : (
          <button className="btn-delete" onClick={() => setConfirmDelete(true)} title="Delete node">
            ✕
          </button>
        )}
      </div>

      <style>{`
        .node-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          height: 40px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
          gap: 8px;
        }
        .node-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .node-title {
          font-weight: 600;
          font-size: 13px;
          cursor: text;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 280px;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .node-title:hover {
          background: var(--surface2);
        }
        .title-input {
          font-weight: 600;
          font-size: 13px;
          background: var(--surface2);
          border: 1px solid var(--accent);
          border-radius: 3px;
          color: var(--text);
          padding: 2px 6px;
          width: 220px;
        }
        .status-select {
          font-size: 11px;
          font-weight: 600;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2px 6px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .status-select:focus { outline: none; border-color: var(--accent); }
        .node-header-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .btn-delete {
          background: transparent;
          color: var(--text-muted);
          font-size: 11px;
          padding: 3px 6px;
          border-radius: 3px;
          opacity: 0.5;
        }
        .btn-delete:hover { background: rgba(224,108,117,0.15); color: var(--error); opacity: 1; }
        .delete-confirm-label {
          font-size: 12px;
          color: var(--error);
        }
        .btn-danger {
          background: var(--error);
          color: #fff;
          font-size: 12px;
          padding: 3px 8px;
        }
        .btn-danger:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
