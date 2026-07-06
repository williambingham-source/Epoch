import { Router, Request } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { initWorkspace, readManifest, listNodes } from '../../core/workspace.js';
import { runGit } from '../../core/_git.js';
import { getRemoteInfo, pushWorkspace, pullWorkspace } from '../../core/sync.js';

export interface WorkspaceSummary {
  name: string;
  displayName: string;
  description?: string;
  nodeCount: number;
  updatedAt: string;
  hasRemote: boolean;
}

export interface GiteaRepo {
  name: string;
  description: string;
  cloneUrl: string;
  updatedAt: string;
  isCloned: boolean;
}

// ---------------------------------------------------------------------------
// Gitea helpers (read config from env at call time so tests can override)
// ---------------------------------------------------------------------------

function giteaConfig() {
  const url = process.env['GITEA_URL'] ?? 'http://localhost:3000';
  const user = process.env['GITEA_USER'] ?? 'william';
  const pass = process.env['GITEA_PASS'] ?? 'epoch-local';
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  return { url, user, pass, auth };
}

async function giteaFetch(apiPath: string, token?: string | null, init?: RequestInit): Promise<Response> {
  const { url, auth } = giteaConfig();
  const authorization = token ? `Bearer ${token}` : `Basic ${auth}`;
  return fetch(`${url}/api/v1${apiPath}`, {
    ...init,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

function makeCloneUrl(repoName: string, token?: string | null): string {
  const { url, user, pass } = giteaConfig();
  const u = new URL(`${url}/${user}/${repoName}.git`);
  if (token) {
    u.username = 'oauth2';
    u.password = token;
  } else {
    u.username = user;
    u.password = pass;
  }
  return u.toString();
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function workspacesRouter(getBaseDir: (req: Request) => string): Router {
  const router = Router();

  // ── GET /api/workspaces ─────────────────────────────────────────────────
  // List all valid local workspaces in the user's base dir.
  router.get('/', async (req, res) => {
    const baseDir = getBaseDir(req);
    try {
      await fs.mkdir(baseDir, { recursive: true });
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
          // Check for git remote without fetching (fast)
          let hasRemote = false;
          try {
            const { stdout } = await runGit(['remote'], wsDir, 3000);
            hasRemote = stdout.trim().length > 0;
          } catch {}

          workspaces.push({
            name: entry.name,
            displayName: manifest.name,
            description: manifest.description,
            nodeCount: nodes.length,
            updatedAt,
            hasRemote,
          });
        } catch {
          // skip non-workspace dirs
        }
      }

      workspaces.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json(workspaces);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /api/workspaces/gitea ────────────────────────────────────────────
  // List Gitea repos, flagged as cloned/not cloned against the local base dir.
  router.get('/gitea', async (req, res) => {
    const baseDir = getBaseDir(req);
    const token = req.headers['x-gitea-token'] as string | undefined;
    try {
      const gRes = await giteaFetch('/user/repos?limit=50&sort=newest', token);
      if (!gRes.ok) {
        res.status(gRes.status).json({ error: `Gitea API error: ${gRes.status}` });
        return;
      }

      const rawRepos = await gRes.json() as Array<{
        name: string;
        description: string;
        clone_url: string;
        updated_at: string;
      }>;

      // Check which names already exist locally
      let localNames = new Set<string>();
      try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) localNames.add(e.name);
        }
      } catch {}

      const repos: GiteaRepo[] = rawRepos.map((r) => ({
        name: r.name,
        description: r.description ?? '',
        cloneUrl: r.clone_url,
        updatedAt: r.updated_at,
        isCloned: localNames.has(r.name),
      }));

      res.json(repos);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /api/workspaces ─────────────────────────────────────────────────
  // Create a new local workspace; optionally also creates a Gitea repo and
  // pushes the initial commit.
  router.post('/', async (req, res) => {
    const baseDir = getBaseDir(req);
    const token = req.headers['x-gitea-token'] as string | undefined;
    try {
      await fs.mkdir(baseDir, { recursive: true });
      const { name, displayName, description, authorName, authorEmail, createGiteaRepo } =
        req.body as {
          name: string;
          displayName?: string;
          description?: string;
          authorName?: string;
          authorEmail?: string;
          createGiteaRepo?: boolean;
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
      } catch {}

      await initWorkspace({
        dir: wsDir,
        name: displayName || name,
        description,
        author: authorName ? { name: authorName, email: authorEmail ?? '' } : undefined,
      });

      if (createGiteaRepo) {
        try {
          // Create the Gitea repo
          const gRes = await giteaFetch('/user/repos', token, {
            method: 'POST',
            body: JSON.stringify({
              name,
              description: description ?? displayName ?? name,
              private: false,
              auto_init: false,
              topics: ['epoch-workspace'],
            }),
          });

          if (gRes.ok) {
            // Wire up remote and push initial commit
            const cloneUrl = makeCloneUrl(name, token);
            try {
              await runGit(['remote', 'add', 'origin', cloneUrl], wsDir, 5000);
              await runGit(['push', '-u', 'origin', 'HEAD'], wsDir, 30000);
            } catch {
              // Non-fatal — workspace created, remote push failed
            }
          }
        } catch {
          // Non-fatal — workspace created, Gitea step failed
        }
      }

      res.status(201).json({ name, displayName: displayName || name });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /api/workspaces/:name/clone ────────────────────────────────────
  // Clone a Gitea repo into baseDir.
  router.post('/:name/clone', async (req, res) => {
    const baseDir = getBaseDir(req);
    const { name } = req.params as { name: string };
    const token = req.headers['x-gitea-token'] as string | undefined;
    await fs.mkdir(baseDir, { recursive: true });

    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      res.status(400).json({ error: 'Invalid workspace name' });
      return;
    }

    const wsDir = path.join(baseDir, name);
    try {
      await fs.access(wsDir);
      res.status(409).json({ error: 'A directory with that name already exists' });
      return;
    } catch {}

    try {
      const cloneUrl = makeCloneUrl(name, token);
      await runGit(['clone', cloneUrl, name], baseDir, 60000);
      res.json({ name, ok: true });
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      res.status(500).json({ error: e.stderr?.trim() || e.message || String(err) });
    }
  });

  // ── GET /api/workspaces/:name/remote ────────────────────────────────────
  // Return git remote info (branch, ahead/behind) for a local workspace.
  router.get('/:name/remote', async (req, res) => {
    const { name } = req.params as { name: string };
    const wsDir = path.join(getBaseDir(req), name);
    try {
      const info = await getRemoteInfo(wsDir);
      res.json(info);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /api/workspaces/:name/push ─────────────────────────────────────
  router.post('/:name/push', async (req, res) => {
    const { name } = req.params as { name: string };
    const wsDir = path.join(getBaseDir(req), name);
    try {
      const result = await pushWorkspace(wsDir);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /api/workspaces/:name/pull ─────────────────────────────────────
  router.post('/:name/pull', async (req, res) => {
    const { name } = req.params as { name: string };
    const wsDir = path.join(getBaseDir(req), name);
    try {
      const result = await pullWorkspace(wsDir);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
