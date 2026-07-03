import React, { useState } from 'react';
import type { NodeEntry, ResearchNode, ProjectStatus, ReviewRequest } from '../types.js';
import { PROJECT_STATUSES } from '../types.js';

interface Props {
  nodePath: string;
  node: ResearchNode;
  /** The status currently persisted on disk (used to detect upgrade). */
  savedStatus: ProjectStatus;
  allNodes: NodeEntry[];
  isDirty: boolean;
  /** The most recent review for this node (any status), if one exists. */
  nodeReview: ReviewRequest | null;
  onChange: (node: ResearchNode) => void;
  onSave: () => void;
  onOpenFolder: (nodePath: string) => void;
  /** Called when user submits a review request with an optional cover note. */
  onRequestReview: (proposedStatus: ProjectStatus, comment: string) => void;
  onViewReview: (review: ReviewRequest) => void;
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
// ReviewRequestForm — inline form shown when user wants to promote status
// ---------------------------------------------------------------------------

function ReviewRequestForm({
  fromStatus,
  toStatus,
  onSubmit,
  onCancel,
}: {
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    setSubmitting(true);
    onSubmit(comment.trim());
  };

  return (
    <div className="review-request-form">
      <p className="section-heading" style={{ marginBottom: 6 }}>
        Request Review: {fromStatus} → {toStatus}
      </p>
      <textarea
        className="review-request-comment"
        placeholder="Optional note for the reviewer — what should they check?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        disabled={submitting}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="btn review-approve-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : '↗ Submit Request'}
        </button>
        <button className="btn secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
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
  nodeReview,
  onChange,
  onSave,
  onOpenFolder,
  onRequestReview,
  onViewReview,
}: Props) {
  const [showReviewForm, setShowReviewForm] = useState(false);

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

  const handleReviewSubmit = (comment: string) => {
    onRequestReview(node.status, comment);
    setShowReviewForm(false);
  };

  // Determine review banner content
  const pendingReview = nodeReview?.status === 'pending' ? nodeReview : null;
  const approvedReview = nodeReview?.status === 'approved' ? nodeReview : null;
  const rejectedReview = nodeReview?.status === 'rejected' ? nodeReview : null;

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
          onChange={(e) => {
            update({ status: e.target.value as ProjectStatus });
            setShowReviewForm(false); // reset form if status changes
          }}
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

        {isUpgrade && !showReviewForm && !pendingReview && (
          <button
            className="btn review-btn"
            onClick={() => setShowReviewForm(true)}
            title={`Request peer review to promote from ${savedStatus} to ${node.status}`}
          >
            ↗ Request Review (→ {node.status})
          </button>
        )}

        {isDirty && !isUpgrade && <span className="muted">Unsaved changes</span>}
      </div>

      {/* Inline review request form */}
      {showReviewForm && isUpgrade && (
        <ReviewRequestForm
          fromStatus={savedStatus}
          toStatus={node.status}
          onSubmit={handleReviewSubmit}
          onCancel={() => setShowReviewForm(false)}
        />
      )}

      {/* Review status banners */}
      {pendingReview && (
        <button className="review-banner review-banner-pending" onClick={() => onViewReview(pendingReview)}>
          <span className="review-banner-icon">⏳</span>
          <span style={{ flex: 1 }}>
            Review pending — <strong>{pendingReview.fromStatus} → {pendingReview.toStatus}</strong>
          </span>
          <span className="review-banner-link">View →</span>
        </button>
      )}

      {approvedReview && (
        <button className="review-banner review-banner-approved" onClick={() => onViewReview(approvedReview)}>
          <span className="review-banner-icon">✓</span>
          <span style={{ flex: 1 }}>
            Approved — promoted to <strong>{approvedReview.toStatus}</strong>
          </span>
          <span className="review-banner-link">View →</span>
        </button>
      )}

      {rejectedReview && (
        <button className="review-banner review-banner-rejected" onClick={() => onViewReview(rejectedReview)}>
          <span className="review-banner-icon">✗</span>
          <span style={{ flex: 1 }}>
            Changes requested on <strong>{rejectedReview.toStatus}</strong> promotion
          </span>
          <span className="review-banner-link">View →</span>
        </button>
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
