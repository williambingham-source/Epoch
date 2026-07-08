import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { Router } from 'express';

const execAsync = promisify(exec);

const WIN_DOCKER_CANDIDATES = [
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe',
];

async function resolveDockerBin(): Promise<string> {
  if (process.platform === 'win32') {
    for (const c of WIN_DOCKER_CANDIDATES) {
      try { await fs.access(c); return c; } catch { /* try next */ }
    }
  }
  return 'docker';
}

export function sageRouter(workspaceDir: string): Router {
  const router = Router();

  // POST /api/sage/run — execute a SageMath snippet, return stdout/stderr.
  // First run pulls sagemath/sagemath:latest (~3 GB); subsequent runs are fast.
  // Scripts run as .sage files so the Sage preparser is active (^, SR(), etc.).
  router.post('/run', async (req, res) => {
    try {
      const { code } = req.body as { code?: string };
      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'code field is required' }); return;
      }

      const id = randomUUID();
      const tmpDir = path.join(workspaceDir, `_sage_${id}`);
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'run.sage'), code, 'utf-8');

      try {
        const dockerBin = await resolveDockerBin();
        const q = (s: string) => s.includes(' ') ? `"${s}"` : s;
        const cmd = [
          q(dockerBin), 'run', '--rm',
          '--volume', q(`${tmpDir}:/work`),
          'sagemath/sagemath:latest',
          'sage', '/work/run.sage',
        ].join(' ');

        let stdout = '';
        let stderr = '';
        try {
          const r = await execAsync(cmd, { maxBuffer: 20 * 1024 * 1024, timeout: 120_000 });
          stdout = r.stdout;
          stderr = r.stderr;
        } catch (e: unknown) {
          const ex = e as { stdout?: string; stderr?: string };
          stdout = ex.stdout ?? '';
          stderr = ex.stderr ?? '';
        }

        res.json({
          output: stdout.trim(),
          stderr: stderr.trim() || null,
        });
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (err) { res.status(500).json({ error: String(err) }); }
  });

  return router;
}
