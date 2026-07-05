'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { updateNode, deleteNode } from '@/lib/api';
import type { NodeSummary, ValidationPathEntry } from '@/lib/api';

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
  validationPath: ValidationPathEntry[];
  allNodes: NodeSummary[];
  onTitleChange: (title: string) => void;
  onStatusChange: (status: string) => void;
  onDescriptionChange: (desc: string) => void;
  onTagsChange: (tags: string[]) => void;
  onValidationPathChange: (vp: ValidationPathEntry[]) => void;
  onDeleted: () => void;
}

export default function NodeHeader({
  path, title, status, description, tags, validationPath, allNodes,
  onTitleChange, onStatusChange, onDescriptionChange, onTagsChange,
  onValidationPathChange, onDeleted,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDesc, setDraftDesc] = useState(description);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingDep, setAddingDep] = useState(false);
  const [depSelection, setDepSelection] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftTitle(title);
    setDraftDesc(description);
    setEditingTitle(false);
    setAddingTag(false);
    setTagInput('');
    setConfirmDelete(false);
    setAddingDep(false);
    setDepSelection('');
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

  // --- Validation path ---
  const available = allNodes.filter(
    (n) => n.path !== path && !validationPath.some((d) => d.nodePath === n.path),
  );

  async function confirmDep() {
    const n = available.find((a) => a.path === depSelection);
    if (!n) return;
    const next: ValidationPathEntry[] = [
      ...validationPath,
      { nodePath: n.path, title: n.title, status: n.status },
    ];
    try {
      await updateNode(path, { validationPath: next });
      onValidationPathChange(next);
    } catch { /* silent */ }
    setDepSelection('');
    setAddingDep(false);
  }

  async function removeDep(i: number) {
    const next = validationPath.filter((_, idx) => idx !== i);
    try {
      await updateNode(path, { validationPath: next });
      onValidationPathChange(next);
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
  const safeStatusIdx = STATUSES.indexOf(safeStatus);

  // Promotion warning: deps whose live status is below the current node status
  const blockingDeps = validationPath
    .map((dep) => {
      const live = allNodes.find((n) => n.path === dep.nodePath);
      const liveStatus = live?.status ?? dep.status;
      const liveIdx = STATUSES.indexOf(liveStatus as Status);
      return liveIdx < safeStatusIdx
        ? { title: dep.title, nodePath: dep.nodePath, liveStatus }
        : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

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

      {/* Row 4: validation path */}
      <div className="vp-section">
        <div className="vp-header">
          <span className="vp-label">Validation Path</span>
        </div>
        {validationPath.length === 0 && !addingDep && (
          <span className="vp-empty">No dependencies —</span>
        )}
        {validationPath.map((dep, i) => {
          const live = allNodes.find((n) => n.path === dep.nodePath);
          const liveStatus = (live?.status ?? dep.status) as Status;
          const color = STATUS_COLOR[liveStatus] ?? '#888';
          return (
            <span key={i} className="vp-dep">
              <span className="vp-dep-dot" style={{ background: color }} />
              <span className="vp-dep-title">{dep.title}</span>
              <span className="vp-dep-status" style={{ color }}>{liveStatus}</span>
              <button className="vp-dep-remove" onClick={() => removeDep(i)} title="Remove dependency">×</button>
            </span>
          );
        })}
        {addingDep ? (
          <div className="vp-add-row">
            <select
              className="vp-select"
              value={depSelection}
              onChange={(e) => setDepSelection(e.target.value)}
              autoFocus
            >
              <option value="">Select node…</option>
              {available.map((n) => (
                <option key={n.path} value={n.path}>
                  {n.title} ({n.status})
                </option>
              ))}
            </select>
            <button className="vp-btn-confirm" onClick={confirmDep} disabled={!depSelection}>Add</button>
            <button className="vp-btn-cancel" onClick={() => { setAddingDep(false); setDepSelection(''); }}>✕</button>
          </div>
        ) : (
          <button
            className="vp-add-btn"
            onClick={() => setAddingDep(true)}
            disabled={available.length === 0}
            title={available.length === 0 ? 'No other nodes available' : 'Add dependency'}
          >
            + dep
          </button>
        )}
      </div>

      {/* Promotion warning */}
      {blockingDeps.length > 0 && (
        <div className="promo-warning">
          <span className="promo-icon">⚠</span>
          <span className="promo-text">
            {blockingDeps.length} dep{blockingDeps.length > 1 ? 's' : ''} below {safeStatus}:
          </span>
          {blockingDeps.map((d) => (
            <span key={d.nodePath} className="promo-dep-chip">
              {d.title}
              <span className="promo-dep-status">({d.liveStatus})</span>
            </span>
          ))}
        </div>
      )}

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

        /* Validation path */
        .vp-section {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          padding: 5px 12px 6px;
          border-top: 1px solid var(--border);
          min-height: 28px;
        }
        .vp-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          opacity: 0.7;
          margin-right: 2px;
        }
        .vp-empty {
          font-size: 11px;
          color: var(--text-muted);
          opacity: 0.5;
        }
        .vp-dep {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1px 6px 1px 6px;
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .vp-dep-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .vp-dep-title { color: var(--text); font-size: 11px; }
        .vp-dep-status { font-size: 10px; opacity: 0.8; }
        .vp-dep-remove {
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          padding: 0 1px;
          opacity: 0.5;
          line-height: 1;
        }
        .vp-dep-remove:hover { opacity: 1; color: var(--error); }

        .vp-add-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .vp-select {
          font-size: 11px;
          background: var(--surface2);
          border: 1px solid var(--accent);
          border-radius: 4px;
          color: var(--text);
          padding: 2px 4px;
          max-width: 200px;
        }
        .vp-btn-confirm {
          font-size: 11px;
          background: var(--accent);
          color: var(--bg);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .vp-btn-confirm:disabled { opacity: 0.4; cursor: default; }
        .vp-btn-cancel {
          font-size: 11px;
          background: transparent;
          color: var(--text-muted);
          padding: 2px 5px;
          border-radius: 4px;
          opacity: 0.6;
        }
        .vp-btn-cancel:hover { opacity: 1; }
        .vp-add-btn {
          background: transparent;
          color: var(--text-muted);
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 10px;
          border: 1px dashed var(--border);
          opacity: 0.6;
        }
        .vp-add-btn:hover:not(:disabled) { opacity: 1; border-color: var(--accent); color: var(--accent); }
        .vp-add-btn:disabled { cursor: default; opacity: 0.3; }

        /* Promotion warning */
        .promo-warning {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          padding: 4px 12px 5px;
          background: rgba(249, 169, 90, 0.08);
          border-top: 1px solid rgba(249, 169, 90, 0.2);
          font-size: 11px;
        }
        .promo-icon { color: #f9a95a; font-size: 12px; }
        .promo-text { color: #f9a95a; }
        .promo-dep-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(249, 169, 90, 0.1);
          border: 1px solid rgba(249, 169, 90, 0.25);
          border-radius: 8px;
          padding: 0 6px;
          color: var(--text-muted);
          font-size: 10px;
        }
        .promo-dep-status { opacity: 0.7; }
      `}</style>
    </div>
  );
}
