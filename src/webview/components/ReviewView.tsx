import React, { useState } from 'react';
import type { ReviewRequest, ProjectStatus } from '../types.js';

interface Props {
  review: ReviewRequest;
  /** True if the current user is the one who submitted the request (suppresses decision buttons). */
  isSelf: boolean;
  onSubmitDecision: (verdict: 'approved' | 'rejected', comment: string) => void;
  onCompile: () => void;
  onClose: () => void;
}

function statusClass(s: ProjectStatus | string): string {
  return `status-badge status-${s.toLowerCase()}`;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function ReviewView({ review, isSelf, onSubmitDecision, onCompile, onClose }: Props) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isResolved = review.status !== 'pending';

  const handleDecision = (verdict: 'approved' | 'rejected') => {
    if (verdict === 'rejected' && !comment.trim()) return;
    setSubmitting(true);
    onSubmitDecision(verdict, comment.trim());
  };

  return (
    <div className="review-view">
      {/* Header */}
      <div className="review-view-header">
        <div className="review-view-title">
          <span>Review: </span>
          <strong>{review.nodeTitle}</strong>
          <span className="review-view-arrow"> — </span>
          <span className={statusClass(review.fromStatus)}>{review.fromStatus}</span>
          <span className="review-view-arrow"> → </span>
          <span className={statusClass(review.toStatus)}>{review.toStatus}</span>
        </div>
        <button className="btn secondary" onClick={onClose} style={{ flexShrink: 0 }}>
          ✕ Close
        </button>
      </div>

      <div className="review-view-body">
        {/* Left: metadata */}
        <div className="review-view-meta">
          <div className="review-meta-section">
            <p className="section-heading">Requested by</p>
            <p>{review.requestedBy.name}</p>
            <p className="muted">{timeAgo(review.requestedAt)}</p>
          </div>

          {review.comment && (
            <div className="review-meta-section">
              <p className="section-heading">Author's note</p>
              <p className="review-comment-text">{review.comment}</p>
            </div>
          )}

          <div className="review-meta-section">
            <p className="section-heading">Validation path</p>
            {review.nodeSnapshot.validationPath.length === 0 ? (
              <p className="muted">No dependencies</p>
            ) : (
              review.nodeSnapshot.validationPath.map((dep, i) => (
                <div key={i} className="dep-row" style={{ fontSize: '0.85em' }}>
                  <span className={statusClass(dep.status)}>{dep.status}</span>
                  <span style={{ flex: 1 }}>{dep.title}</span>
                </div>
              ))
            )}
          </div>

          {review.nodeSnapshot.description && (
            <div className="review-meta-section">
              <p className="section-heading">Description</p>
              <p className="muted" style={{ fontSize: '0.9em' }}>{review.nodeSnapshot.description}</p>
            </div>
          )}

          {/* Resolved state */}
          {isResolved && review.decisions.length > 0 && (
            <div className="review-meta-section">
              <p className="section-heading">Decision</p>
              {review.decisions.map((d, i) => (
                <div key={i} className={`review-decision-badge ${d.verdict}`}>
                  <span>{d.verdict === 'approved' ? '✓ Approved' : '✗ Changes requested'}</span>
                  <span className="muted"> by {d.by.name}</span>
                  {d.comment && <p style={{ marginTop: 4 }}>{d.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: content.tex */}
        <div className="review-view-content">
          <div className="review-content-toolbar">
            <span className="section-heading" style={{ margin: 0 }}>
              content.tex — snapshot at request time
            </span>
            <button className="btn secondary" onClick={onCompile} style={{ padding: '2px 10px', fontSize: '0.85em' }}>
              ⊞ View in PDF
            </button>
          </div>
          <pre className="review-content-pre">
            <code>{review.contentSnapshot || '(no content.tex)'}</code>
          </pre>
        </div>
      </div>

      {/* Decision row — only for reviewer on pending reviews */}
      {!isResolved && !isSelf && (
        <div className="review-view-decision">
          <textarea
            className="review-decision-comment"
            placeholder="Comment (required for Request Changes, optional for Approve)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            disabled={submitting}
          />
          <div className="review-decision-buttons">
            <button
              className="btn secondary"
              onClick={() => handleDecision('rejected')}
              disabled={submitting || !comment.trim()}
              title="Request changes (comment required)"
            >
              ✗ Request Changes
            </button>
            <button
              className="btn review-approve-btn"
              onClick={() => handleDecision('approved')}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : '✓ Approve'}
            </button>
          </div>
        </div>
      )}

      {!isResolved && isSelf && (
        <div className="review-view-decision">
          <p className="muted" style={{ padding: '8px 0' }}>
            You submitted this review request — waiting for a collaborator to approve or request changes.
          </p>
        </div>
      )}
    </div>
  );
}
