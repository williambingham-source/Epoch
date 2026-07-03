import React from 'react';
import type { ReviewRequest } from '../types.js';

interface Props {
  reviews: ReviewRequest[];
  onOpenReview: (review: ReviewRequest) => void;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function statusIcon(status: ReviewRequest['status']): string {
  return status === 'pending' ? '⏳' : status === 'approved' ? '✓' : '✗';
}

export function ReviewsPanel({ reviews, onOpenReview }: Props) {
  const pending = reviews.filter((r) => r.status === 'pending');
  const resolved = reviews.filter((r) => r.status !== 'pending');

  return (
    <div className="reviews-panel">
      <div className="sidebar-header">
        <span>
          Reviews{pending.length > 0 && (
            <span className="review-badge">{pending.length}</span>
          )}
        </span>
      </div>

      {reviews.length === 0 && (
        <p className="muted" style={{ padding: '10px 14px', fontSize: '0.85em' }}>
          No reviews yet.
        </p>
      )}

      {pending.map((r) => (
        <button key={r.id} className="review-card review-card-pending" onClick={() => onOpenReview(r)}>
          <span className="review-card-icon">⏳</span>
          <span className="review-card-body">
            <span className="review-card-title">{r.nodeTitle}</span>
            <span className="review-card-meta muted">
              {r.fromStatus} → {r.toStatus} · {timeAgo(r.requestedAt)}
            </span>
          </span>
        </button>
      ))}

      {resolved.length > 0 && (
        <>
          {pending.length > 0 && <div className="reviews-divider" />}
          {resolved.map((r) => (
            <button key={r.id} className="review-card review-card-resolved" onClick={() => onOpenReview(r)}>
              <span className={`review-card-icon ${r.status === 'approved' ? 'approved' : 'rejected'}`}>
                {statusIcon(r.status)}
              </span>
              <span className="review-card-body">
                <span className="review-card-title">{r.nodeTitle}</span>
                <span className="review-card-meta muted">
                  {r.toStatus} · {r.resolvedAt ? timeAgo(r.resolvedAt) : ''}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
