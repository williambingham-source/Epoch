import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { compileFragment } from '../../tools/latex-compiler.js';

export function pdfRouter(workspaceDir: string): Router {
  const router = Router();

  // GET /api/pdf/:encodedPath — compile a node's content.tex and return PDF bytes
  router.get('/:encodedPath', async (req, res) => {
    try {
      const nodePath = decodeURIComponent(req.params['encodedPath'] ?? '');
      const texPath = path.join(workspaceDir, nodePath, 'content.tex');

      let latex: string;
      try {
        latex = await fs.readFile(texPath, 'utf-8');
      } catch {
        res.status(404).json({ error: `No content.tex found at ${nodePath}` });
        return;
      }

      if (!latex.trim()) {
        res.status(422).json({ error: 'content.tex is empty' });
        return;
      }

      const result = await compileFragment(latex, workspaceDir);

      if (!result.success || !result.pdfBytes) {
        res.status(422).json({ error: result.error ?? 'Compilation failed' });
        return;
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
