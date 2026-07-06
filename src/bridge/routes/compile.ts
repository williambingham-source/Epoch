import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { compileFragment } from '../../tools/latex-compiler.js';

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

/** Generate a thumbnail PNG for the first page of a PDF using Ghostscript
 *  inside the same texlive Docker image used for compilation. */
async function makeThumbnail(
  pdfBytes: Buffer,
  workspaceDir: string,
  dpi = 150,
): Promise<Buffer> {
  const id = randomUUID();
  const pdfFile = `_epoch_thumb_${id}.pdf`;
  const pngFile = `_epoch_thumb_${id}.png`;
  const pdfPath = path.join(workspaceDir, pdfFile);
  const pngPath = path.join(workspaceDir, pngFile);

  await fs.writeFile(pdfPath, pdfBytes);
  try {
    const dockerBin = await resolveDockerBin();
    const q = (s: string) => s.includes(' ') ? `"${s}"` : s;
    const cmd = [
      q(dockerBin), 'run', '--rm',
      '--volume', q(`${workspaceDir}:/workspace`),
      'texlive/texlive:latest',
      'gs', '-dNOPAUSE', '-dBATCH',
      '-sDEVICE=png16m', `-r${dpi}`,
      '-dFirstPage=1', '-dLastPage=1',
      `-sOutputFile=/workspace/${pngFile}`,
      `/workspace/${pdfFile}`,
    ].join(' ');
    await execAsync(cmd, { maxBuffer: 20 * 1024 * 1024 });
    return await fs.readFile(pngPath);
  } finally {
    await Promise.all([
      fs.unlink(pdfPath).catch(() => {}),
      fs.unlink(pngPath).catch(() => {}),
    ]);
  }
}

export function compileRouter(workspaceDir: string): Router {
  const router = Router();

  // POST /api/compile — compile a LaTeX fragment, return PDF bytes.
  // Optional body field `nodePath`: if provided, saves first-page PNG as
  // <workspaceDir>/<nodePath>/data/thumbnail.png for the DAG view.
  router.post('/', async (req, res) => {
    try {
      const { latex, nodePath } = req.body as { latex: string; nodePath?: string };
      if (!latex) {
        res.status(400).json({ error: 'latex field is required' });
        return;
      }

      const result = await compileFragment(latex, workspaceDir);

      if (!result.success || !result.pdfBytes) {
        res.status(422).json({ error: result.error ?? 'Compilation failed' });
        return;
      }

      // Save PDF + generate thumbnail asynchronously — don't block the response
      if (nodePath && /^[^.][^/]*(?:\/[^.][^/]*)*$/.test(nodePath)) {
        const pdfBytes = Buffer.from(result.pdfBytes);
        const dataDir = path.join(workspaceDir, nodePath, 'data');
        (async () => {
          try {
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(path.join(dataDir, 'content.pdf'), pdfBytes);
          } catch { /* best-effort */ }
          try {
            const png = await makeThumbnail(pdfBytes, workspaceDir);
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(path.join(dataDir, 'thumbnail.png'), png);
          } catch { /* best-effort */ }
        })();
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', result.pdfBytes.length);
      res.send(result.pdfBytes);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
