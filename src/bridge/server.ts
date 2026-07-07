#!/usr/bin/env node
/**
 * Epoch Bridge Service
 * Runs two transports on the same process:
 *   - Express REST API on port 3002 (for epoch-web + Excalidraw)
 *   - MCP SSE endpoint at /mcp          (for remote MCP clients)
 *
 * When called with --mcp-stdio, starts stdio MCP only (for Claude Code .mcp.json).
 *
 * Multi-workspace: set WORKSPACES_BASE_DIR to the parent directory that contains
 * all workspace folders.  Defaults to the parent of WORKSPACE_DIR.  Clients send
 * an  x-workspace: <folder-name>  header to select a workspace per-request.
 */
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { access } from 'fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { nodesRouter } from './routes/nodes.js';
import { filesRouter } from './routes/files.js';
import { compileRouter } from './routes/compile.js';
import { compilePngRouter } from './routes/compilePng.js';
import { convertRouter } from './routes/convert.js';
import { pdfRouter } from './routes/pdf.js';
import { providersRouter } from './routes/providers.js';
import { workspacesRouter } from './routes/workspaces.js';
import { settingsRouter } from './routes/settings.js';
import { createBridgeMcpServer, startStdioMcpServer } from './mcp/index.js';

const WORKSPACE_DIR = process.env['WORKSPACE_DIR'];
const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

if (!WORKSPACE_DIR) {
  console.error('[epoch-bridge] WORKSPACE_DIR env var is required');
  process.exit(1);
}

// Base directory that contains workspace folders.
// Defaults to the parent of WORKSPACE_DIR so existing single-workspace setups
// automatically discover their workspace without any extra config.
const WORKSPACES_BASE_DIR =
  process.env['WORKSPACES_BASE_DIR'] ?? path.dirname(WORKSPACE_DIR);

// Stdio MCP mode for Claude Code .mcp.json
if (process.argv.includes('--mcp-stdio')) {
  startStdioMcpServer(WORKSPACE_DIR).catch((err) => {
    console.error('[epoch-bridge] MCP stdio error:', err);
    process.exit(1);
  });
} else {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // ── Workspace resolution middleware ──────────────────────────────────────
  // Reads x-workspace and x-gitea-user headers. When a user is present, the
  // workspace is resolved under WORKSPACES_BASE_DIR/<user>/<wsName> so each
  // user's workspaces are fully isolated at the filesystem level.
  //
  // Allowlist: only accepts a resolved path that contains manifest.json —
  // a positive check that it is a real Epoch workspace, not just any directory
  // that happens to pass the name pattern.
  app.use(async (req, res, next) => {
    const wsName = req.headers['x-workspace'] as string | undefined;
    const user   = req.headers['x-gitea-user'] as string | undefined;
    if (wsName && /^[a-zA-Z0-9_-]+$/.test(wsName)) {
      const userSeg = (user && /^[a-zA-Z0-9_.-]+$/.test(user)) ? user : '';
      const parent  = userSeg ? path.join(WORKSPACES_BASE_DIR, userSeg) : WORKSPACES_BASE_DIR;
      const resolved = path.resolve(path.join(parent, wsName));
      // Guard 1: resolved path must be strictly inside WORKSPACES_BASE_DIR
      if (resolved.startsWith(path.resolve(WORKSPACES_BASE_DIR) + path.sep)) {
        // Guard 2: positive allowlist — must be a real Epoch workspace
        try {
          await access(path.join(resolved, 'manifest.json'));
          res.locals['workspaceDir'] = resolved;
        } catch { /* not a valid workspace — fall through to default */ }
      }
    }
    next();
  });

  // ── withWorkspace ────────────────────────────────────────────────────────
  // Wraps a router factory so that routers are created per workspace dir and
  // cached — each Router instance is stateless so reuse is safe.
  function withWorkspace(factory: (dir: string) => express.Router): express.RequestHandler {
    const cache = new Map<string, express.Router>();
    return (req, res, next) => {
      const dir = (res.locals['workspaceDir'] as string | undefined) ?? WORKSPACE_DIR!;
      let router = cache.get(dir);
      if (!router) {
        router = factory(dir);
        cache.set(dir, router);
      }
      router(req, res, next);
    };
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      workspace: WORKSPACE_DIR,
      workspacesBase: WORKSPACES_BASE_DIR,
      provider: process.env['VISION_PROVIDER'] ?? 'anthropic',
    });
  });

  // User settings (API keys, vision provider preference) — keyed by x-gitea-user
  app.use('/api/settings', settingsRouter(WORKSPACES_BASE_DIR));

  // Workspace management — base dir is per-user when x-gitea-user is present
  app.use('/api/workspaces', workspacesRouter((req) => {
    const user = req.headers['x-gitea-user'] as string | undefined;
    if (user && /^[a-zA-Z0-9_.-]+$/.test(user)) {
      return path.join(WORKSPACES_BASE_DIR, user);
    }
    return WORKSPACES_BASE_DIR;
  }));

  // Workspace-scoped REST routes (resolved per-request via x-workspace header)
  app.use('/api/nodes', withWorkspace(nodesRouter));
  app.use('/api/files', withWorkspace(filesRouter));
  app.use('/api/compile', withWorkspace(compileRouter));
  app.use('/api/compile-png', withWorkspace(compilePngRouter));
  app.use('/api/convert', withWorkspace(convertRouter));
  app.use('/api/pdf', withWorkspace(pdfRouter));
  app.use('/api/providers', providersRouter());

  // MCP SSE transport — always uses the default WORKSPACE_DIR (for Claude Code)
  const mcpServer = createBridgeMcpServer(WORKSPACE_DIR);
  const sseTransports = new Map<string, SSEServerTransport>();

  app.get('/mcp', async (req, res) => {
    const transport = new SSEServerTransport('/mcp/message', res);
    const sessionId = transport.sessionId;
    sseTransports.set(sessionId, transport);
    res.on('close', () => sseTransports.delete(sessionId));
    await mcpServer.connect(transport);
  });

  app.post('/mcp/message', async (req, res) => {
    const sessionId = req.query['sessionId'] as string;
    const transport = sseTransports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // ── WebSocket chat ────────────────────────────────────────────────────────
  // One room per workspace name. Rooms are plain broadcast — no CRDT needed.
  // Clients connect to ws://host:3002/chat?workspace=<name>&user=<login>
  const wss = new WebSocketServer({ noServer: true });
  // room key → Map<socket, username>
  const chatRooms = new Map<string, Map<WebSocket, string>>();

  function broadcast(room: Map<WebSocket, string>, payload: object, exclude?: WebSocket) {
    const msg = JSON.stringify(payload);
    for (const [client] of room) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) client.send(msg);
    }
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const workspace = url.searchParams.get('workspace') ?? 'default';
    const user = (url.searchParams.get('user') ?? 'anonymous').slice(0, 64);

    if (!chatRooms.has(workspace)) chatRooms.set(workspace, new Map());
    const room = chatRooms.get(workspace)!;
    room.set(ws, user);

    broadcast(room, { type: 'join', user, ts: Date.now() }, ws);

    ws.on('message', (data) => {
      const text = data.toString().slice(0, 2000);
      broadcast(room, { type: 'message', user, text, ts: Date.now() });
    });

    ws.on('close', () => {
      room.delete(ws);
      broadcast(room, { type: 'leave', user, ts: Date.now() });
      if (room.size === 0) chatRooms.delete(workspace);
    });

    ws.on('error', () => { ws.terminate(); });
  });

  const server = createServer(app);
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://localhost`);
    if (url.pathname === '/chat') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[epoch-bridge] REST + MCP SSE + WS chat on 0.0.0.0:${PORT}`);
    console.log(`[epoch-bridge] default workspace : ${WORKSPACE_DIR}`);
    console.log(`[epoch-bridge] workspaces base   : ${WORKSPACES_BASE_DIR}`);
    console.log(`[epoch-bridge] vision provider   : ${process.env['VISION_PROVIDER'] ?? 'anthropic'}`);
  });
}
