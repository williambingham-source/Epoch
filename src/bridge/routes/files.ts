import { Router } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';

export function filesRouter(workspaceDir: string): Router {
  const router = Router();
  const root = path.resolve(workspaceDir);

  function safePath(rel: string): string {
    if (!rel && rel !== '') rel = '';
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root)) throw new Error('Path traversal not allowed');
    // Block .git access
    const parts = rel.split(/[\\/]/);
    if (parts.some((p) => p === '.git')) throw new Error('.git access not allowed');
    return abs;
  }

  function relPath(abs: string): string {
    return path.relative(root, abs).replace(/\\/g, '/');
  }

  // GET /api/files/list?dir=   list entries in a directory ('' = workspace root)
  router.get('/list', async (req, res) => {
    try {
      const dir = (req.query['dir'] as string) ?? '';
      const abs = safePath(dir);
      const rawEntries = await fs.readdir(abs, { withFileTypes: true });
      const entries = rawEntries
        .filter((e) => e.name !== '.git')
        .map((e) => ({
          name: e.name,
          isDir: e.isDirectory(),
          path: dir ? `${dir}/${e.name}` : e.name,
        }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      res.json(entries);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/files/read?path=   read a file as UTF-8 text
  router.get('/read', async (req, res) => {
    try {
      const rel = (req.query['path'] as string) ?? '';
      const abs = safePath(rel);
      const stat = await fs.stat(abs);
      if (stat.isDirectory()) {
        res.status(400).json({ error: 'Path is a directory' });
        return;
      }
      // For large or binary files return base64
      const buf = await fs.readFile(abs);
      const isText = isTextFile(rel);
      if (isText) {
        res.json({ path: rel, content: buf.toString('utf-8'), encoding: 'utf-8', size: stat.size });
      } else {
        res.json({ path: rel, content: buf.toString('base64'), encoding: 'base64', size: stat.size });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/files/upload   { dir, name, content (base64) }
  router.post('/upload', async (req, res) => {
    try {
      const { dir = '', name, content } = req.body as { dir?: string; name: string; content: string };
      if (!name) { res.status(400).json({ error: 'name is required' }); return; }
      const rel = dir ? `${dir}/${name}` : name;
      const abs = safePath(rel);
      const buf = Buffer.from(content, 'base64');
      await fs.writeFile(abs, buf);
      res.json({ ok: true, path: relPath(abs) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/files/mkdir   { path }
  router.post('/mkdir', async (req, res) => {
    try {
      const { path: rel } = req.body as { path: string };
      if (!rel) { res.status(400).json({ error: 'path is required' }); return; }
      const abs = safePath(rel);
      await fs.mkdir(abs, { recursive: true });
      res.json({ ok: true, path: rel });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/files/create   { path, content? }
  router.post('/create', async (req, res) => {
    try {
      const { path: rel, content = '' } = req.body as { path: string; content?: string };
      if (!rel) { res.status(400).json({ error: 'path is required' }); return; }
      const abs = safePath(rel);
      await fs.writeFile(abs, content, 'utf-8');
      res.json({ ok: true, path: rel });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/files   body: { path }
  router.delete('/', async (req, res) => {
    try {
      const { path: rel } = req.body as { path: string };
      if (!rel) { res.status(400).json({ error: 'path is required' }); return; }
      const abs = safePath(rel);
      await fs.rm(abs, { recursive: true, force: true });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/files/rename   { from, to }
  router.post('/rename', async (req, res) => {
    try {
      const { from, to } = req.body as { from: string; to: string };
      if (!from || !to) { res.status(400).json({ error: 'from and to are required' }); return; }
      const absFrom = safePath(from);
      const absTo = safePath(to);
      await fs.rename(absFrom, absTo);
      res.json({ ok: true, path: relPath(absTo) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}

const TEXT_EXTS = new Set([
  '.tex', '.txt', '.md', '.json', '.js', '.ts', '.py', '.sh',
  '.yaml', '.yml', '.toml', '.csv', '.html', '.css', '.bib', '.cls', '.sty',
]);

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTS.has(ext);
}
