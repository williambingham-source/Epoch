import * as path from 'path';
import * as fs from 'fs/promises';
import { Router } from 'express';
import { compileFragment } from '../../tools/latex-compiler.js';
import { pdfToPng } from '../utils/pdfToPng.js';

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

      // Save thumbnail asynchronously — don't block the PDF response
      if (nodePath && /^[^.][^/]*(?:\/[^.][^/]*)*$/.test(nodePath)) {
        (async () => {
          try {
            const png = await pdfToPng(result.pdfBytes!);
            const thumbDir = path.join(workspaceDir, nodePath, 'data');
            await fs.mkdir(thumbDir, { recursive: true });
            await fs.writeFile(
              path.join(thumbDir, 'thumbnail.png'),
              Buffer.from(png, 'base64'),
            );
          } catch { /* thumbnail is best-effort */ }
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
