import { Router } from 'express';
import { compileFragment } from '../../tools/latex-compiler.js';

export function compileRouter(workspaceDir: string): Router {
  const router = Router();

  // POST /api/compile — compile a LaTeX fragment, return PDF bytes
  router.post('/', async (req, res) => {
    try {
      const { latex } = req.body as { latex: string };
      if (!latex) {
        res.status(400).json({ error: 'latex field is required' });
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
