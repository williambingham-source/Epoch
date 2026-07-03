import type { ResearchNode } from './node.js';
import type { ProjectStatus } from './project.js';

export interface ReviewDecision {
  by: { name: string; email: string };
  at: string;
  verdict: 'approved' | 'rejected';
  comment: string;
}

export interface ReviewRequest {
  id: string;
  /** Workspace-relative path to the node folder, e.g. "2-2-4". */
  nodePath: string;
  nodeTitle: string;
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  requestedBy: { name: string; email: string };
  requestedAt: string;
  /** Author's note to the reviewer explaining what to check. */
  comment: string;
  /** Full content.tex at the time of request, so the reviewer sees exactly what was claimed. */
  contentSnapshot: string;
  /** Full node.json at the time of request. */
  nodeSnapshot: ResearchNode;
  decisions: ReviewDecision[];
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
}

export function isReviewRequest(val: unknown): val is ReviewRequest {
  if (typeof val !== 'object' || val === null) return false;
  const r = val as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['nodePath'] === 'string' &&
    typeof r['nodeTitle'] === 'string' &&
    typeof r['fromStatus'] === 'string' &&
    typeof r['toStatus'] === 'string' &&
    typeof r['requestedAt'] === 'string' &&
    Array.isArray(r['decisions']) &&
    (r['status'] === 'pending' || r['status'] === 'approved' || r['status'] === 'rejected')
  );
}
