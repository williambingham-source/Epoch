import { Router } from 'express';
import { compileFragment } from '../../tools/latex-compiler.js';
import { pdfToPng } from '../utils/pdfToPng.js';

export function compilePngRouter(workspaceDir: string): Router {
  const router = Router();

  // POST /api/compile-png — compile a LaTeX fragment, return first page as PNG (base64)
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

      const png = await pdfToPng(result.pdfBytes);
      res.json({ png });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
