import { runGit, findGitRoot } from './_git.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RemoteInfo {
  url: string | null;
  /** URL without credentials for display (e.g. "localhost:3000/william/epoch"). */
  displayUrl: string | null;
  /** Full URL without credentials for browser navigation. */
  browseUrl: string | null;
  branch: string;
  ahead: number;
  behind: number;
  lastCommit?: string;
  hasRemote: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// getRemoteInfo
// ---------------------------------------------------------------------------

export async function getRemoteInfo(workspaceDir: string): Promise<RemoteInfo> {
  const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;

  // Branch (always available, even without remote)
  let branch = 'master';
  try {
    const { stdout } = await runGit(['branch', '--show-current'], root);
    branch = stdout.trim() || 'master';
  } catch {}

  // Remote URL
  let url: string | null = null;
  try {
    const { stdout } = await runGit(['remote', 'get-url', 'origin'], root);
    url = stdout.trim();
  } catch {
    return { url: null, displayUrl: null, browseUrl: null, branch, ahead: 0, behind: 0, hasRemote: false };
  }

  // Strip credentials and .git suffix for display / browser links
  const noAuth = url.replace(/:\/\/[^:@]+:[^@]+@/, '://').replace(/\.git$/, '');
  const displayUrl = noAuth.replace(/^https?:\/\//, '');
  const browseUrl = noAuth;

  // Fetch quietly (5-second timeout; failure is non-fatal)
  try {
    await runGit(['fetch', '--quiet', 'origin'], root, 5000);
  } catch {}

  // Ahead / behind relative to remote tracking branch
  let ahead = 0;
  let behind = 0;
  try {
    const { stdout } = await runGit(
      ['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`],
      root,
    );
    const parts = stdout.trim().split('\t');
    behind = parseInt(parts[0] ?? '0', 10) || 0;
    ahead = parseInt(parts[1] ?? '0', 10) || 0;
  } catch {}

  // Last commit summary
  let lastCommit: string | undefined;
  try {
    const { stdout } = await runGit(['log', '-1', '--format=%ar: %s'], root);
    lastCommit = stdout.trim() || undefined;
  } catch {}

  return { url, displayUrl, browseUrl, branch, ahead, behind, lastCommit, hasRemote: true };
}

// ---------------------------------------------------------------------------
// pushWorkspace
// ---------------------------------------------------------------------------

export async function pushWorkspace(workspaceDir: string): Promise<SyncResult> {
  const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;

  try {
    // Stage any modified / untracked files under the workspace directory
    const { stdout: statusOut } = await runGit(['status', '--porcelain', '--', workspaceDir], root);

    if (statusOut.trim()) {
      await runGit(['add', '--', workspaceDir], root);

      // Commit only if something was actually staged
      try {
        await runGit(['diff', '--cached', '--quiet'], root);
        // exit 0 → nothing staged (unlikely after git add)
      } catch {
        // exit 1 → staged changes → commit them
        const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
        await runGit(['commit', '-m', `workspace: save changes ${ts}`], root);
      }
    }

    const { stdout, stderr } = await runGit(
      ['push', '--set-upstream', 'origin', 'HEAD'],
      root,
      30000,
    );
    const output = (stdout + stderr).trim();

    return {
      success: true,
      message: output.toLowerCase().includes('everything up-to-date')
        ? 'Already up to date'
        : 'Pushed successfully',
      details: output || undefined,
    };
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const details = [e.stderr, e.stdout, e.message].filter(Boolean).join('\n').trim();
    return { success: false, message: 'Push failed', details };
  }
}

// ---------------------------------------------------------------------------
// pullWorkspace
// ---------------------------------------------------------------------------

export async function pullWorkspace(workspaceDir: string): Promise<SyncResult> {
  const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;

  try {
    const { stdout, stderr } = await runGit(['pull', '--ff-only'], root, 30000);
    const output = (stdout + stderr).trim();

    return {
      success: true,
      message: output.toLowerCase().includes('already up to date')
        ? 'Already up to date'
        : 'Pulled successfully',
      details: output || undefined,
    };
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const details = [e.stderr, e.stdout, e.message].filter(Boolean).join('\n').trim();
    return { success: false, message: 'Pull failed', details };
  }
}
