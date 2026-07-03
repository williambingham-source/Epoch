import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  listNodes,
  readNode,
  writeNode,
  addNode,
  readManifest,
  type AddNodeOptions,
  type WriteNodeOptions,
} from '../../core/workspace.js';
import { ProjectStatus } from '../../types/project.js';

export function nodesRouter(workspaceDir: string): Router {
  const router = Router();

  // GET /api/nodes — flat list of all nodes
  router.get('/', async (_req, res) => {
    try {
      const entries = await listNodes(workspaceDir);
      res.json(
        entries.map((e) => ({
          path: e.path,
          title: e.node.title,
          status: e.node.status,
          tags: e.node.tags,
        })),
      );
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/nodes/manifest
  router.get('/manifest', async (_req, res) => {
    try {
      const manifest = await readManifest(workspaceDir);
      res.json(manifest);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/nodes/:encodedPath — single node metadata + latex
  router.get('/:encodedPath', async (req, res) => {
    try {
      const nodePath = decodeURIComponent(req.params['encodedPath'] ?? '');
      const absNodePath = path.join(workspaceDir, nodePath);
      const node = await readNode(absNodePath);
      const texPath = path.join(absNodePath, 'content.tex');
      let latex = '';
      try {
        latex = await fs.readFile(texPath, 'utf-8');
      } catch {
        // node has no content.tex yet
      }
      res.json({ path: nodePath, node, latex });
    } catch (err) {
      res.status(404).json({ error: String(err) });
    }
  });

  // POST /api/nodes — create new node (Flow A accept)
  router.post('/', async (req, res) => {
    try {
      const { parentPath, title, status, latex, inkPng } = req.body as {
        parentPath: string;
        title: string;
        status?: ProjectStatus;
        latex?: string;
        inkPng?: string;
      };

      const { nodePath } = await addNode({
        workspaceDir,
        parentPath: parentPath || null,
        title,
      } satisfies AddNodeOptions);

      const absNodePath = path.join(workspaceDir, nodePath);

      // Write initial status if overridden
      if (status) {
        const node = await readNode(absNodePath);
        node.status = status;
        await writeNode({ workspaceDir, nodePath, node, commitMessage: `create node: ${title}` } satisfies WriteNodeOptions);
      }

      // Overwrite content.tex if provided (addNode already wrote a stub)
      if (latex) {
        await fs.writeFile(path.join(absNodePath, 'content.tex'), latex, 'utf-8');
      }

      // Archive source ink if provided
      if (inkPng) {
        const dataDir = path.join(absNodePath, 'data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(path.join(dataDir, 'source-ink.png'), Buffer.from(inkPng, 'base64'));
      }

      res.status(201).json({ path: nodePath, title });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/nodes/:encodedPath — update node metadata and/or content.tex
  router.put('/:encodedPath', async (req, res) => {
    try {
      const nodePath = decodeURIComponent(req.params['encodedPath'] ?? '');
      const absNodePath = path.join(workspaceDir, nodePath);
      const { latex, title, description, status, tags, commitMessage } = req.body as {
        latex?: string;
        title?: string;
        description?: string;
        status?: ProjectStatus;
        tags?: string[];
        commitMessage?: string;
      };

      const node = await readNode(absNodePath);

      if (title !== undefined) node.title = title;
      if (description !== undefined) node.description = description;
      if (status !== undefined) node.status = status;
      if (tags !== undefined) node.tags = tags;

      if (latex !== undefined) {
        await fs.writeFile(path.join(absNodePath, 'content.tex'), latex, 'utf-8');
      }

      await writeNode({
        workspaceDir,
        nodePath,
        node,
        commitMessage: commitMessage ?? `update node via canvas: ${node.title}`,
      } satisfies WriteNodeOptions);

      res.json({ path: nodePath, ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
