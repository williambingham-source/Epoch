import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Git binary resolution (Windows-safe)
// ---------------------------------------------------------------------------

const WIN_GIT_CANDIDATES = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
];

let _gitBin: string | null = null;

async function resolveGit(): Promise<string> {
  if (_gitBin) return _gitBin;
  if (process.platform === 'win32') {
    for (const c of WIN_GIT_CANDIDATES) {
      try {
        await fs.access(c);
        _gitBin = c;
        return c;
      } catch {}
    }
  }
  _gitBin = 'git';
  return 'git';
}

function runGit(args: string[], cwd: string, timeoutMs = 15000): Promise<{ stdout: string; stderr: string }> {
  return new Promise(async (resolve, reject) => {
    const bin = await resolveGit();
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`git ${args[0]} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const child = execFile(
      bin,
      args,
      { cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        if (err) reject(Object.assign(err, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Git root discovery
// ---------------------------------------------------------------------------

async function findGitRoot(dir: string): Promise<string | null> {
  let current = path.resolve(dir);
  while (true) {
    try {
      await fs.access(path.join(current, '.git'));
      return current;
    } catch {}
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

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
    const relPath = path.relative(root, workspaceDir).replace(/\\/g, '/') || '.';
    const { stdout: statusOut } = await runGit(['status', '--porcelain', '--', relPath], root);

    if (statusOut.trim()) {
      await runGit(['add', '--', relPath], root);

      // Commit only if something was actually staged
      try {
        // --quiet exits 0 if nothing staged, 1 if staged changes exist
        await runGit(['diff', '--cached', '--quiet'], root);
        // exit 0 → nothing staged (shouldn't normally happen after git add)
      } catch {
        // exit 1 → staged changes present → commit
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
