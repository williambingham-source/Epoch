import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs/promises';

import {
  listNodes,
  readNode,
  writeNode,
  addNode,
  type AddNodeOptions,
  type WriteNodeOptions,
} from '../../core/workspace.js';
import { compileFragment } from '../../tools/latex-compiler.js';
import { createProvider, activeProviderName, AVAILABLE_PROVIDERS } from '../vision/provider.js';
import type { ProviderName } from '../vision/provider.js';
import { ProjectStatus } from '../../types/project.js';
import { BRIDGE_TOOLS } from './tools.js';

export function createBridgeMcpServer(workspaceDir: string): Server {
  const server = new Server(
    { name: 'epoch-bridge', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: BRIDGE_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const a = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case 'convert_ink': {
          const image = a['image'] as string;
          const hint = a['hint'] as string | undefined;
          const providerName = (a['provider'] as ProviderName | undefined) ?? activeProviderName();
          const model = a['model'] as string | undefined;
          const provider = await createProvider(providerName, model);
          const result = await provider.convertImage(image, hint);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'compile_latex': {
          const latex = a['latex'] as string;
          const result = await compileFragment(latex, workspaceDir);
          if (!result.success || !result.pdfBytes) {
            throw new McpError(ErrorCode.InternalError, result.error ?? 'Compilation failed');
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                pdfBase64: result.pdfBytes.toString('base64'),
                bytes: result.pdfBytes.length,
              }, null, 2),
            }],
          };
        }

        case 'list_nodes': {
          const entries = await listNodes(workspaceDir);
          const list = entries.map((e) => ({
            path: e.path,
            title: e.node.title,
            status: e.node.status,
          }));
          return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
        }

        case 'get_node': {
          const nodePath = a['path'] as string;
          const absPath = path.join(workspaceDir, nodePath);
          const node = await readNode(absPath);
          let latex = '';
          try { latex = await fs.readFile(path.join(absPath, 'content.tex'), 'utf-8'); } catch {}
          return {
            content: [{ type: 'text', text: JSON.stringify({ path: nodePath, node, latex }, null, 2) }],
          };
        }

        case 'create_node': {
          const parentPath = a['parentPath'] as string;
          const title = a['title'] as string;
          const status = a['status'] as ProjectStatus | undefined;
          const latex = a['latex'] as string | undefined;
          const inkPng = a['inkPng'] as string | undefined;

          const { nodePath: relPath } = await addNode({
            workspaceDir,
            parentPath: parentPath || null,
            title,
          } satisfies AddNodeOptions);

          const absNode = path.join(workspaceDir, relPath);

          if (status) {
            const node = await readNode(absNode);
            node.status = status;
            await writeNode({ workspaceDir, nodePath: relPath, node, commitMessage: `create node: ${title}` } satisfies WriteNodeOptions);
          }

          if (latex) await fs.writeFile(path.join(absNode, 'content.tex'), latex, 'utf-8');
          if (inkPng) {
            const dataDir = path.join(absNode, 'data');
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(path.join(dataDir, 'source-ink.png'), Buffer.from(inkPng, 'base64'));
          }

          return { content: [{ type: 'text', text: JSON.stringify({ path: relPath, title }) }] };
        }

        case 'update_node': {
          const nodePath = a['path'] as string;
          const latex = a['latex'] as string;
          const commitMessage = a['commitMessage'] as string | undefined;
          const absPath = path.join(workspaceDir, nodePath);
          await fs.writeFile(path.join(absPath, 'content.tex'), latex, 'utf-8');
          const node = await readNode(absPath);
          await writeNode({
            workspaceDir,
            nodePath,
            node,
            commitMessage: commitMessage ?? `update node via canvas: ${node.title}`,
          } satisfies WriteNodeOptions);
          return { content: [{ type: 'text', text: JSON.stringify({ path: nodePath, ok: true }) }] };
        }

        case 'get_node_pdf': {
          const nodePath = a['path'] as string;
          const texPath = path.join(workspaceDir, nodePath, 'content.tex');
          const latex = await fs.readFile(texPath, 'utf-8');
          const result = await compileFragment(latex, workspaceDir);
          if (!result.success || !result.pdfBytes) {
            throw new McpError(ErrorCode.InternalError, result.error ?? 'Compilation failed');
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ pdfBase64: result.pdfBytes.toString('base64') }),
            }],
          };
        }

        case 'open_in_canvas': {
          const nodePath = a['path'] as string;
          const url = `http://localhost:3001?node=${encodeURIComponent(nodePath)}`;
          return { content: [{ type: 'text', text: url }] };
        }

        case 'get_vision_providers': {
          const active = activeProviderName();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ active, available: AVAILABLE_PROVIDERS }, null, 2),
            }],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (err) {
      if (err instanceof McpError) throw err;
      throw new McpError(ErrorCode.InternalError, String(err));
    }
  });

  return server;
}

// Stdio entry point — used by .mcp.json when running outside Docker
export async function startStdioMcpServer(workspaceDir: string): Promise<void> {
  const server = createBridgeMcpServer(workspaceDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
