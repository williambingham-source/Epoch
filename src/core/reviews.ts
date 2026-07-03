/**
 * In-app peer review — reviews are stored as JSON files in {workspaceDir}/reviews/
 * and synced between collaborators via the normal git push/pull workflow.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ReviewRequest, ReviewDecision } from '../types/review.js';
import { isReviewRequest } from '../types/review.js';
import type { ProjectStatus } from '../types/project.js';
import { writeNode } from './workspace.js';
import { runGit, findGitRoot } from './_git.js';

const REVIEWS_DIR = 'reviews';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reviewFilePath(workspaceDir: string, id: string): string {
  return path.join(workspaceDir, REVIEWS_DIR, `${id}.json`);
}

async function writeReview(workspaceDir: string, review: ReviewRequest): Promise<void> {
  const dir = path.join(workspaceDir, REVIEWS_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(reviewFilePath(workspaceDir, review.id), JSON.stringify(review, null, 2), 'utf-8');
}

async function commitReview(workspaceDir: string, review: ReviewRequest, message: string): Promise<void> {
  const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;
  const absFile = reviewFilePath(workspaceDir, review.id);
  const relFile = path.relative(root, absFile).replace(/\\/g, '/');
  try {
    await runGit(['add', '--', relFile], root);
    await runGit(['commit', '-m', message], root);
  } catch {
    // best-effort: file is saved even if git isn't set up
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listReviews(workspaceDir: string): Promise<ReviewRequest[]> {
  const dir = path.join(workspaceDir, REVIEWS_DIR);
  try {
    const entries = await fs.readdir(dir);
    const results: ReviewRequest[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry), 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        if (isReviewRequest(parsed)) results.push(parsed);
      } catch {
        // skip malformed files
      }
    }
    // Newest first
    return results.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  } catch {
    return [];
  }
}

export async function getReview(workspaceDir: string, id: string): Promise<ReviewRequest | null> {
  try {
    const raw = await fs.readFile(reviewFilePath(workspaceDir, id), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return isReviewRequest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function createReview(opts: {
  workspaceDir: string;
  nodePath: string;
  proposedStatus: ProjectStatus;
  comment: string;
  author: { name: string; email: string };
}): Promise<ReviewRequest> {
  const { workspaceDir, nodePath, proposedStatus, comment, author } = opts;

  // Snapshot the current node.json
  const nodeJsonPath = path.join(workspaceDir, nodePath, 'node.json');
  const nodeRaw = await fs.readFile(nodeJsonPath, 'utf-8');
  const nodeSnapshot = JSON.parse(nodeRaw) as ReviewRequest['nodeSnapshot'];

  // Snapshot content.tex (best-effort)
  let contentSnapshot = '';
  try {
    contentSnapshot = await fs.readFile(path.join(workspaceDir, nodePath, 'content.tex'), 'utf-8');
  } catch { /* node may have no content.tex */ }

  const review: ReviewRequest = {
    id: crypto.randomUUID(),
    nodePath,
    nodeTitle: nodeSnapshot.title,
    fromStatus: nodeSnapshot.status,
    toStatus: proposedStatus,
    requestedBy: author,
    requestedAt: new Date().toISOString(),
    comment,
    contentSnapshot,
    nodeSnapshot,
    decisions: [],
    status: 'pending',
  };

  await writeReview(workspaceDir, review);
  await commitReview(
    workspaceDir,
    review,
    `review: request "${review.nodeTitle}" ${review.fromStatus} → ${review.toStatus}`,
  );

  return review;
}

export async function submitDecision(opts: {
  workspaceDir: string;
  reviewId: string;
  verdict: 'approved' | 'rejected';
  comment: string;
  reviewer: { name: string; email: string };
}): Promise<ReviewRequest> {
  const { workspaceDir, reviewId, verdict, comment, reviewer } = opts;

  const review = await getReview(workspaceDir, reviewId);
  if (!review) throw new Error(`Review not found: ${reviewId}`);
  if (review.status !== 'pending') throw new Error(`Review ${reviewId} is already ${review.status}`);

  const decision: ReviewDecision = {
    by: reviewer,
    at: new Date().toISOString(),
    verdict,
    comment,
  };

  const updated: ReviewRequest = {
    ...review,
    decisions: [...review.decisions, decision],
    status: verdict,
    resolvedAt: new Date().toISOString(),
  };

  await writeReview(workspaceDir, updated);

  // If approved, promote the node status on disk
  if (verdict === 'approved') {
    await writeNode({
      workspaceDir,
      nodePath: review.nodePath,
      node: { ...review.nodeSnapshot, status: review.toStatus },
      commitMessage: `review: approve "${review.nodeTitle}" → ${review.toStatus}`,
      author: reviewer,
    });
  }

  // Commit the review file (node.json commit already happened inside writeNode if approved)
  const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;
  const absFile = reviewFilePath(workspaceDir, updated.id);
  const relFile = path.relative(root, absFile).replace(/\\/g, '/');
  try {
    await runGit(['add', '--', relFile], root);
    const msg = verdict === 'approved'
      ? `review: approve "${review.nodeTitle}" → ${review.toStatus}`
      : `review: request changes on "${review.nodeTitle}"`;
    await runGit(['commit', '-m', msg], root);
  } catch { /* best-effort */ }

  return updated;
}
