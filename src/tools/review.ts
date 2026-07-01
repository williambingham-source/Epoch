/**
 * PR-based peer review using the Gitea REST API.
 *
 * Workflow:
 *   1. openReview() — creates a review branch with the proposed status, pushes
 *      it, and opens a Gitea pull request from that branch → master.
 *   2. Reviewer reads the diff (shows the status change in node.json) and
 *      comments in Gitea.
 *   3. Merging the PR (in Gitea) promotes the node on master.
 *   4. User pulls via the Sync panel to receive the merged status locally.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { runGit, findGitRoot } from '../core/_git.js';
import type { ResearchNode } from '../types/node.js';

// ---------------------------------------------------------------------------
// Gitea API helpers
// ---------------------------------------------------------------------------

interface GiteaConfig {
  apiBase: string;
  owner: string;
  repo: string;
  basicAuth: string;
}

export function parseGiteaRemote(remoteUrl: string): GiteaConfig | null {
  const m = remoteUrl.match(
    /^(https?):\/\/([^:@]+):([^@]+)@([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/,
  );
  if (!m) return null;
  const proto = m[1], user = m[2], pass = m[3], host = m[4], owner = m[5], repo = m[6];
  if (!proto || !user || !pass || !host || !owner || !repo) return null;
  return {
    apiBase: `${proto}://${host}/api/v1`,
    owner,
    repo,
    basicAuth: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
  };
}

async function giteaFetch<T = unknown>(
  config: GiteaConfig,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${config.apiBase}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.basicAuth,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gitea ${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReviewInfo {
  prNumber: number;
  url: string;
  branch: string;
  title: string;
}

export interface ReviewSummary extends ReviewInfo {
  state: 'open' | 'closed' | 'merged';
}

// ---------------------------------------------------------------------------
// openReview
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export interface OpenReviewOptions {
  workspaceDir: string;
  /** Workspace-relative path to the node folder. */
  nodePath: string;
  /** The full proposed node (with the new/target status already set). */
  proposedNode: ResearchNode;
  /** Git remote URL (used to derive Gitea API endpoint and credentials). */
  remoteUrl: string;
}

export async function openReview(opts: OpenReviewOptions): Promise<ReviewInfo> {
  const { workspaceDir, nodePath, proposedNode, remoteUrl } = opts;

  const gitea = parseGiteaRemote(remoteUrl);
  if (!gitea) throw new Error('Cannot parse Gitea remote from: ' + remoteUrl);

  const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;
  const nodeJsonAbs = path.join(workspaceDir, nodePath, 'node.json');
  const nodeJsonRel = path.relative(root, nodeJsonAbs).replace(/\\/g, '/');

  // Get the current branch name so we know what to PR into and switch back to
  const { stdout: branchOut } = await runGit(['branch', '--show-current'], root);
  const baseBranch = branchOut.trim() || 'master';

  // Unique review branch name (base-36 timestamp avoids collisions on re-requests)
  const branchName = `review/${slugify(proposedNode.title)}-${Date.now().toString(36)}`;

  // Read the current node.json so we know the from-status and can restore on failure
  const originalJson = await fs.readFile(nodeJsonAbs, 'utf-8');
  const originalNode = JSON.parse(originalJson) as ResearchNode;

  try {
    // 1. Create the review branch from current HEAD (no file changes yet)
    await runGit(['checkout', '-b', branchName], root);

    // 2. Write the proposed node.json on this branch
    const proposed: ResearchNode = { ...proposedNode, updatedAt: new Date().toISOString() };
    await fs.writeFile(nodeJsonAbs, JSON.stringify(proposed, null, 2), 'utf-8');

    // 3. Stage + commit the status change
    await runGit(['add', '--', nodeJsonRel], root);
    await runGit(
      [
        'commit',
        '-m',
        `review: propose "${proposedNode.title}" → ${proposedNode.status}`,
      ],
      root,
    );

    // 4. Push the branch to the remote
    await runGit(['push', '--set-upstream', 'origin', branchName], root, 30000);
  } finally {
    // Always switch back — restores node.json to the base-branch version
    try {
      await runGit(['checkout', baseBranch], root);
    } catch {
      // If checkout fails (e.g. merge conflict) force-restore the file
      await fs.writeFile(nodeJsonAbs, originalJson, 'utf-8');
    }
  }

  // 5. Create the pull request via the Gitea API
  const fromStatus = originalNode.status;
  const toStatus = proposedNode.status;
  const prTitle = `Review: "${proposedNode.title}" — ${fromStatus} → ${toStatus}`;

  const depLines =
    proposedNode.validationPath.length > 0
      ? proposedNode.validationPath
          .map((d) => `- **${d.title}** (${d.status}) — \`${d.nodePath}\``)
          .join('\n')
      : '_No dependencies_';

  const prBody = [
    `## ${proposedNode.title}`,
    '',
    proposedNode.description ?? '_No description provided._',
    '',
    `**Proposed promotion:** ${fromStatus} → ${toStatus}`,
    '',
    '### Validation Path',
    depLines,
    '',
    '---',
    `_Review request created by Epoch &middot; node: \`${nodePath}\`_`,
  ].join('\n');

  const pr = await giteaFetch<{ number: number; html_url: string }>(
    gitea,
    'POST',
    `/repos/${gitea.owner}/${gitea.repo}/pulls`,
    { title: prTitle, body: prBody, head: branchName, base: baseBranch },
  );

  return { prNumber: pr.number, url: pr.html_url, branch: branchName, title: prTitle };
}

// ---------------------------------------------------------------------------
// listReviews — open Epoch review PRs for this repo
// ---------------------------------------------------------------------------

export async function listReviews(remoteUrl: string): Promise<ReviewSummary[]> {
  const gitea = parseGiteaRemote(remoteUrl);
  if (!gitea) return [];

  try {
    const prs = await giteaFetch<
      Array<{ number: number; html_url: string; title: string; state: string; merged: boolean }>
    >(gitea, 'GET', `/repos/${gitea.owner}/${gitea.repo}/pulls?state=open&limit=50`);

    return prs
      .filter((pr) => pr.title.startsWith('Review:'))
      .map((pr) => ({
        prNumber: pr.number,
        url: pr.html_url,
        title: pr.title,
        branch: '',
        state: pr.merged ? 'merged' : (pr.state as 'open' | 'closed'),
      }));
  } catch {
    return [];
  }
}
