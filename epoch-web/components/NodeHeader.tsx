'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  description: string;
  tags: string[];
  onTitleChange: (title: string) => void;
  onStatusChange: (status: string) => void;
  onDescriptionChange: (desc: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDeleted: () => void;
}

export default function NodeHeader({
  path, title, status, description, tags,
  onTitleChange, onStatusChange, onDescriptionChange, onTagsChange, onDeleted,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDesc, setDraftDesc] = useState(description);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Desc auto-save timer
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when node changes
  useEffect(() => {
    setDraftTitle(title);
    setDraftDesc(description);
    setEditingTitle(false);
    setAddingTag(false);
    setTagInput('');
    setConfirmDelete(false);
  }, [title, description, path]);

  // --- Title ---
  async function commitTitle() {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === title) {
      setEditingTitle(false);
      setDraftTitle(title);
      return;
    }
    setSaving(true);
    try {
      await updateNode(path, { title: trimmed });
      onTitleChange(trimmed);
    } catch {
      setDraftTitle(title);
    } finally {
      setSaving(false);
      setEditingTitle(false);
    }
  }

  // --- Status ---
  async function handleStatusChange(newStatus: string) {
    try {
      await updateNode(path, { status: newStatus });
      onStatusChange(newStatus);
    } catch { /* silent */ }
  }

  // --- Description ---
  const saveDesc = useCallback(async (value: string) => {
    try {
      await updateNode(path, { description: value });
      onDescriptionChange(value);
    } catch { /* silent */ }
  }, [path, onDescriptionChange]);

  function handleDescChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setDraftDesc(v);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => saveDesc(v), 1500);
  }

  // --- Tags ---
  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    try {
      await updateNode(path, { tags: next });
      onTagsChange(next);
    } catch { /* silent */ }
  }

  async function commitTag() {
    const trimmed = tagInput.trim().toLowerCase();
    setTagInput('');
    setAddingTag(false);
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed];
    try {
      await updateNode(path, { tags: next });
      onTagsChange(next);
    } catch { /* silent */ }
  }

  // --- Delete ---
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
      {/* Row 1: title / status / delete */}
      <div className="header-row1">
        <div className="header-left">
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
            <span className="node-title" onClick={() => setEditingTitle(true)} title="Click to rename">
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

        <div className="header-right">
          {confirmDelete ? (
            <>
              <span className="delete-confirm-label">Delete?</span>
              <button className="btn-danger" onClick={handleDelete} disabled={saving}>Yes</button>
              <button onClick={() => setConfirmDelete(false)}>No</button>
            </>
          ) : (
            <button className="btn-delete" onClick={() => setConfirmDelete(true)} title="Delete node">✕</button>
          )}
        </div>
      </div>

      {/* Row 2: description */}
      <textarea
        className="desc-input"
        value={draftDesc}
        onChange={handleDescChange}
        placeholder="Add a description…"
        rows={1}
      />

      {/* Row 3: tags */}
      <div className="tags-row">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button className="tag-remove" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}>×</button>
          </span>
        ))}
        {addingTag ? (
          <input
            ref={tagInputRef}
            className="tag-input"
            value={tagInput}
            placeholder="tag name"
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={commitTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitTag(); }
              if (e.key === 'Escape') { setAddingTag(false); setTagInput(''); }
            }}
            autoFocus
          />
        ) : (
          <button className="tag-add-btn" onClick={() => setAddingTag(true)} title="Add tag">+ tag</button>
        )}
      </div>

      <style>{`
        .node-header {
          display: flex;
          flex-direction: column;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
        }
        .header-row1 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          height: 40px;
          gap: 8px;
        }
        .header-left {
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
        .node-title:hover { background: var(--surface2); }
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
        .header-right {
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
        .delete-confirm-label { font-size: 12px; color: var(--error); }
        .btn-danger {
          background: var(--error);
          color: #fff;
          font-size: 12px;
          padding: 3px 8px;
        }
        .btn-danger:hover { opacity: 0.85; }

        .desc-input {
          resize: none;
          background: transparent;
          border: none;
          border-top: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 12px;
          padding: 6px 16px;
          font-family: inherit;
          line-height: 1.5;
          min-height: 30px;
          max-height: 80px;
          overflow-y: auto;
          field-sizing: content;
        }
        .desc-input:focus {
          outline: none;
          color: var(--text);
          background: var(--surface2);
        }
        .desc-input::placeholder { color: var(--text-muted); opacity: 0.5; }

        .tags-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          padding: 5px 12px 6px;
          border-top: 1px solid var(--border);
          min-height: 28px;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: var(--accent-dim);
          color: var(--text-muted);
          font-size: 11px;
          padding: 1px 6px 1px 8px;
          border-radius: 10px;
          white-space: nowrap;
        }
        .tag-remove {
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          padding: 0 1px;
          line-height: 1;
          opacity: 0.6;
        }
        .tag-remove:hover { opacity: 1; color: var(--error); }
        .tag-add-btn {
          background: transparent;
          color: var(--text-muted);
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 10px;
          border: 1px dashed var(--border);
          opacity: 0.6;
        }
        .tag-add-btn:hover { opacity: 1; border-color: var(--accent); color: var(--accent); }
        .tag-input {
          font-size: 11px;
          background: var(--surface2);
          border: 1px solid var(--accent);
          border-radius: 10px;
          color: var(--text);
          padding: 1px 8px;
          width: 100px;
        }
      `}</style>
    </div>
  );
}
