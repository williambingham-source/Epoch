import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { initWorkspace, readManifest, listNodes } from '../../core/workspace.js';

export interface WorkspaceSummary {
  name: string;
  displayName: string;
  description?: string;
  nodeCount: number;
  updatedAt: string;
}

export function workspacesRouter(baseDir: string): Router {
  const router = Router();

  // GET /api/workspaces — list all subdirs of baseDir that have manifest.json
  router.get('/', async (_req, res) => {
    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const workspaces: WorkspaceSummary[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const wsDir = path.join(baseDir, entry.name);
        try {
          await fs.access(path.join(wsDir, 'manifest.json'));
          const manifest = await readManifest(wsDir);
          const nodes = await listNodes(wsDir);
          const updatedAt = nodes.reduce(
            (latest, n) => (n.node.updatedAt > latest ? n.node.updatedAt : latest),
            manifest.createdAt,
          );
          workspaces.push({
            name: entry.name,
            displayName: manifest.name,
            description: manifest.description,
            nodeCount: nodes.length,
            updatedAt,
          });
        } catch {
          // not a valid Epoch workspace — skip
        }
      }

      workspaces.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json(workspaces);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/workspaces — create a new workspace
  router.post('/', async (req, res) => {
    try {
      const { name, displayName, description, authorName, authorEmail } = req.body as {
        name: string;
        displayName?: string;
        description?: string;
        authorName?: string;
        authorEmail?: string;
      };

      if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
        res.status(400).json({ error: 'Invalid name — use letters, numbers, hyphens, underscores only' });
        return;
      }

      const wsDir = path.join(baseDir, name);
      try {
        await fs.access(wsDir);
        res.status(409).json({ error: 'A workspace with that name already exists' });
        return;
      } catch {
        // good — doesn't exist yet
      }

      await initWorkspace({
        dir: wsDir,
        name: displayName || name,
        description,
        author: authorName ? { name: authorName, email: authorEmail ?? '' } : undefined,
      });

      res.status(201).json({ name, displayName: displayName || name });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
