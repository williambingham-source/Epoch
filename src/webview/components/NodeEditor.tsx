import React, { useState } from 'react';
import type { NodeEntry, ResearchNode, ProjectStatus, ReviewInfo } from '../types.js';
import { PROJECT_STATUSES } from '../types.js';

interface Props {
  nodePath: string;
  node: ResearchNode;
  /** The status currently persisted on disk (used to detect upgrade). */
  savedStatus: ProjectStatus;
  allNodes: NodeEntry[];
  isDirty: boolean;
  reviewPending: boolean;
  lastReview: ReviewInfo | null;
  onChange: (node: ResearchNode) => void;
  onSave: () => void;
  onOpenFolder: (nodePath: string) => void;
  onRequestReview: (node: ResearchNode) => void;
  onOpenExternal: (url: string) => void;
}

function statusClass(status: ProjectStatus): string {
  return `status-badge status-${status.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// AddDependency — inline picker for adding a validationPath entry
// ---------------------------------------------------------------------------

function AddDependency({
  allNodes,
  currentPath,
  node,
  onChange,
}: {
  allNodes: NodeEntry[];
  currentPath: string;
  node: ResearchNode;
  onChange: (node: ResearchNode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');

  const available = allNodes.filter(
    (n) =>
      n.path !== currentPath &&
      !node.validationPath.some((d) => d.nodePath === n.path),
  );

  if (!open) {
    return (
      <button
        className="btn secondary"
        style={{ marginTop: 8 }}
        onClick={() => setOpen(true)}
        disabled={available.length === 0}
      >
        + Add dependency
      </button>
    );
  }

  const confirm = () => {
    const dep = available.find((n) => n.path === selected);
    if (!dep) return;
    onChange({
      ...node,
      validationPath: [
        ...node.validationPath,
        { title: dep.node.title, status: dep.node.status, nodePath: selected },
      ],
    });
    setSelected('');
    setOpen(false);
  };

  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        className="field"
        style={{ margin: 0, flex: 1 }}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Select node…</option>
        {available.map((n) => (
          <option key={n.path} value={n.path}>
            {n.node.title} ({n.path})
          </option>
        ))}
      </select>
      <button className="btn" onClick={confirm} disabled={!selected}>
        Add
      </button>
      <button
        className="btn secondary"
        onClick={() => {
          setOpen(false);
          setSelected('');
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodeEditor
// ---------------------------------------------------------------------------

export function NodeEditor({
  nodePath,
  node,
  savedStatus,
  allNodes,
  isDirty,
  reviewPending,
  lastReview,
  onChange,
  onSave,
  onOpenFolder,
  onRequestReview,
  onOpenExternal,
}: Props) {
  const update = (partial: Partial<ResearchNode>) => onChange({ ...node, ...partial });

  const tagsValue = node.tags?.join(', ') ?? '';

  // Show "Request Review" when the user is promoting the status (not downgrading,
  // not Sketch — explanatory nodes stay at Sketch without review).
  const savedIdx = PROJECT_STATUSES.indexOf(savedStatus);
  const editingIdx = PROJECT_STATUSES.indexOf(node.status);
  const isUpgrade = editingIdx > savedIdx && node.status !== 'Sketch';
  const handleTags = (raw: string) => {
    const tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    update({ tags: tags.length > 0 ? tags : undefined });
  };

  const removeDep = (index: number) => {
    update({ validationPath: node.validationPath.filter((_, i) => i !== index) });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ flex: 1, fontSize: '1.3em' }}>{node.title}</h2>
        <span className={statusClass(node.status)}>{node.status}</span>
        <button
          className="btn secondary"
          onClick={() => onOpenFolder(nodePath)}
          title="Reveal folder in Explorer"
        >
          ⇱ Folder
        </button>
      </div>

      <div className="field">
        <label>Title</label>
        <input value={node.title} onChange={(e) => update({ title: e.target.value })} />
      </div>

      <div className="field">
        <label>Status</label>
        <select
          value={node.status}
          onChange={(e) => update({ status: e.target.value as ProjectStatus })}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Description</label>
        <textarea
          rows={4}
          value={node.description ?? ''}
          onChange={(e) => update({ description: e.target.value || undefined })}
        />
      </div>

      <div className="field">
        <label>Tags (comma-separated)</label>
        <input value={tagsValue} onChange={(e) => handleTags(e.target.value)} />
      </div>

      {/* Validation path */}
      <div style={{ marginBottom: 20 }}>
        <p className="section-heading">Validation Path</p>
        {node.validationPath.length === 0 ? (
          <p className="muted" style={{ marginBottom: 8 }}>
            No dependencies
          </p>
        ) : (
          node.validationPath.map((dep, i) => (
            <div key={i} className="dep-row">
              <span className={statusClass(dep.status)}>{dep.status}</span>
              <span style={{ flex: 1 }}>{dep.title}</span>
              <code className="dep-path">{dep.nodePath}</code>
              <button className="dep-remove" onClick={() => removeDep(i)} title="Remove">
                ×
              </button>
            </div>
          ))
        )}
        <AddDependency
          allNodes={allNodes}
          currentPath={nodePath}
          node={node}
          onChange={onChange}
        />
      </div>

      <div className="actions">
        <button className="btn" onClick={onSave} disabled={!isDirty}>
          Save
        </button>

        {isUpgrade && (
          <button
            className="btn review-btn"
            onClick={() => onRequestReview(node)}
            disabled={reviewPending}
            title={`Open a peer-review pull request to promote this node from ${savedStatus} to ${node.status}`}
          >
            {reviewPending ? 'Opening PR…' : `↗ Request Review (→ ${node.status})`}
          </button>
        )}

        {isDirty && !isUpgrade && <span className="muted">Unsaved changes</span>}
      </div>

      {/* Review status banner */}
      {lastReview && (
        <div className="review-banner">
          <span className="review-banner-icon">⎔</span>
          <span>
            PR #{lastReview.prNumber} opened —{' '}
            <strong>{lastReview.title}</strong>
          </span>
          <button
            className="review-banner-link"
            onClick={() => onOpenExternal(lastReview.url)}
          >
            View in Gitea →
          </button>
        </div>
      )}

      <div className="meta-row" style={{ marginTop: 24 }}>
        <span className="muted">Created {new Date(node.createdAt).toLocaleString()}</span>
        <span className="muted">Updated {new Date(node.updatedAt).toLocaleString()}</span>
      </div>
      <div className="muted" style={{ marginTop: 4, fontFamily: 'monospace', fontSize: '0.8em' }}>
        {node.id}
      </div>
    </div>
  );
}
