#!/usr/bin/env node
/**
 * Epoch Bridge Service
 * Runs two transports on the same process:
 *   - Express REST API on port 3002 (for Excalidraw browser app)
 *   - MCP SSE endpoint at /mcp          (for remote MCP clients)
 *
 * When called with --mcp-stdio, starts stdio MCP only (for Claude Code .mcp.json).
 */
import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { nodesRouter } from './routes/nodes.js';
import { compileRouter } from './routes/compile.js';
import { compilePngRouter } from './routes/compilePng.js';
import { convertRouter } from './routes/convert.js';
import { pdfRouter } from './routes/pdf.js';
import { providersRouter } from './routes/providers.js';
import { createBridgeMcpServer, startStdioMcpServer } from './mcp/index.js';

const WORKSPACE_DIR = process.env['WORKSPACE_DIR'];
const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

if (!WORKSPACE_DIR) {
  console.error('[epoch-bridge] WORKSPACE_DIR env var is required');
  process.exit(1);
}

// Stdio MCP mode for Claude Code .mcp.json
if (process.argv.includes('--mcp-stdio')) {
  startStdioMcpServer(WORKSPACE_DIR).catch((err) => {
    console.error('[epoch-bridge] MCP stdio error:', err);
    process.exit(1);
  });
} else {
  // Full Express server (REST + SSE MCP)
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, workspace: WORKSPACE_DIR, provider: process.env['VISION_PROVIDER'] ?? 'anthropic' });
  });

  // REST routes
  app.use('/api/nodes', nodesRouter(WORKSPACE_DIR));
  app.use('/api/compile', compileRouter(WORKSPACE_DIR));
  app.use('/api/compile-png', compilePngRouter(WORKSPACE_DIR));
  app.use('/api/convert', convertRouter(WORKSPACE_DIR));
  app.use('/api/pdf', pdfRouter(WORKSPACE_DIR));
  app.use('/api/providers', providersRouter());

  // MCP SSE transport
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[epoch-bridge] REST + MCP SSE listening on 0.0.0.0:${PORT}`);
    console.log(`[epoch-bridge] workspace: ${WORKSPACE_DIR}`);
    console.log(`[epoch-bridge] vision provider: ${process.env['VISION_PROVIDER'] ?? 'anthropic'}`);
  });
}
