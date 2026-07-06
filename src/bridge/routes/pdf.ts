import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { compileFragment, compileWorkspace } from '../../tools/latex-compiler.js';

export function pdfRouter(workspaceDir: string): Router {
  const router = Router();

  // POST /api/pdf/workspace — compile all nodes in topological order, return full PDF.
  router.post('/workspace', async (req, res) => {
    try {
      const result = await compileWorkspace({ workspaceDir });

      if (!result.success || !result.outputPath) {
        res.status(422).json({ error: result.errors.join(' | ') || 'Compilation failed' });
        return;
      }

      const pdfBytes = await fs.readFile(result.outputPath);
      // Clean up the temp compile output, then cache to data/workspace.pdf.
      // Use pdfBytes already in memory so unlink order doesn't matter.
      fs.unlink(result.outputPath).catch(() => {});
      const dataDir = path.join(workspaceDir, 'data');
      fs.mkdir(dataDir, { recursive: true })
        .then(() => fs.writeFile(path.join(dataDir, 'workspace.pdf'), pdfBytes))
        .catch(() => {});

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(pdfBytes);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/pdf/workspace — serve cached workspace.pdf if it exists
  router.get('/workspace', async (_req, res) => {
    try {
      const cached = path.join(workspaceDir, 'data', 'workspace.pdf');
      const buf = await fs.readFile(cached);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(buf);
    } catch {
      res.status(404).json({ error: 'No cached workspace PDF' });
    }
  });

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
