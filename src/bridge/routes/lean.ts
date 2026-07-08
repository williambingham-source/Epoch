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

function validateNodePath(p: string): boolean {
  return /^[^.][^/]*(?:\/[^.][^/]*)*$/.test(p);
}

export interface LeanDiagnostic {
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

function parseLeanOutput(output: string): LeanDiagnostic[] {
  const diagnostics: LeanDiagnostic[] = [];
  const lines = output.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Lean 4: /path/file.lean:LINE:COL: severity: message
    const m = lines[i]!.match(/^[^:]+:(\d+):(\d+):\s*(error|warning|info):\s*(.*)$/);
    if (m) {
      let message = m[4]!;
      // collect indented continuation lines
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1]!)) {
        i++;
        message += '\n' + lines[i]!.trimStart();
      }
      diagnostics.push({
        line: parseInt(m[1]!, 10),
        col: parseInt(m[2]!, 10),
        severity: m[3] as 'error' | 'warning' | 'info',
        message: message.trim(),
      });
    }
  }
  return diagnostics;
}

export function leanRouter(workspaceDir: string): Router {
  const router = Router();

  // GET /api/lean/:encodedPath — read data/proof.lean for a node
  router.get('/:encodedPath', async (req, res) => {
    try {
      const nodePath = decodeURIComponent(req.params['encodedPath'] ?? '');
      if (!validateNodePath(nodePath)) {
        res.status(400).json({ error: 'Invalid node path' }); return;
      }
      const filePath = path.join(workspaceDir, nodePath, 'data', 'proof.lean');
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
      } catch {
        res.json({ content: '' }); // no proof file yet
      }
    } catch (err) { res.status(500).json({ error: String(err) }); }
  });

  // PUT /api/lean/:encodedPath — write data/proof.lean for a node
  router.put('/:encodedPath', async (req, res) => {
    try {
      const nodePath = decodeURIComponent(req.params['encodedPath'] ?? '');
      if (!validateNodePath(nodePath)) {
        res.status(400).json({ error: 'Invalid node path' }); return;
      }
      const { content } = req.body as { content?: string };
      if (typeof content !== 'string') {
        res.status(400).json({ error: 'content field required' }); return;
      }
      const dataDir = path.join(workspaceDir, nodePath, 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(path.join(dataDir, 'proof.lean'), content, 'utf-8');
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: String(err) }); }
  });

  // POST /api/lean/:encodedPath/check — run lean check in Docker
  // Body (optional): { content: string } — saves before checking if provided
  // First run pulls leanprover/lean4:latest (~800 MB); subsequent runs are fast.
  router.post('/:encodedPath/check', async (req, res) => {
    try {
      const nodePath = decodeURIComponent(req.params['encodedPath'] ?? '');
      if (!validateNodePath(nodePath)) {
        res.status(400).json({ error: 'Invalid node path' }); return;
      }

      const { content } = req.body as { content?: string };
      const dataDir = path.join(workspaceDir, nodePath, 'data');
      const proofFile = path.join(dataDir, 'proof.lean');

      let proofContent: string;
      if (typeof content === 'string') {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(proofFile, content, 'utf-8');
        proofContent = content;
      } else {
        try {
          proofContent = await fs.readFile(proofFile, 'utf-8');
        } catch {
          res.status(404).json({ error: 'No proof.lean found for this node' }); return;
        }
      }

      const id = randomUUID();
      const tmpDir = path.join(workspaceDir, `_lean_${id}`);
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'proof.lean'), proofContent, 'utf-8');

      try {
        const dockerBin = await resolveDockerBin();
        const q = (s: string) => s.includes(' ') ? `"${s}"` : s;
        const cmd = [
          q(dockerBin), 'run', '--rm',
          '--volume', q(`${tmpDir}:/work`),
          'leanprover/lean4:latest',
          'lean', '/work/proof.lean',
        ].join(' ');

        let stdout = '';
        let stderr = '';
        try {
          const r = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 300_000 });
          stdout = r.stdout;
          stderr = r.stderr;
        } catch (e: unknown) {
          const ex = e as { stdout?: string; stderr?: string };
          stdout = ex.stdout ?? '';
          stderr = ex.stderr ?? '';
        }

        const rawOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
        const diagnostics = parseLeanOutput(rawOutput);
        const hasErrors = diagnostics.some((d) => d.severity === 'error');
        res.json({ ok: !hasErrors, diagnostics, rawOutput });
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (err) { res.status(500).json({ error: String(err) }); }
  });

  return router;
}
