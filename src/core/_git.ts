/**
 * Shared system-git helpers used by sync.ts and review.ts.
 * Uses child_process (Node-only) with Windows-safe binary resolution.
 */

import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

const WIN_GIT_CANDIDATES = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
];

let _gitBin: string | null = null;

export async function resolveGit(): Promise<string> {
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

export function runGit(
  args: string[],
  cwd: string,
  timeoutMs = 15000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    resolveGit().then((bin) => {
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
  });
}

export async function findGitRoot(dir: string): Promise<string | null> {
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
