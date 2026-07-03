import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Phase 1 — single project.json repos
import {
  initRepository,
  readProject,
  writeProject,
  getHistory,
} from '../core/repository-node.js';

// Phase 2 — fractal workspace
import {
  initWorkspace,
  addNode,
  moveNode,
  readNode,
  writeNode,
  listNodes,
  readManifest,
  getWorkspaceHistory,
} from '../core/workspace.js';

// Compilers
import { compileProject, compileWorkspace } from '../tools/latex-compiler.js';

// Sync
import { pushWorkspace, pullWorkspace, getRemoteInfo } from '../core/sync.js';

// Review
import { createReview, listReviews, submitDecision } from '../core/reviews.js';

// Types
import { isProject } from '../types/project.js';
import { isResearchNode } from '../types/node.js';

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'epoch', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool list
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ---- Phase 2: Fractal Workspace ----------------------------------------
    {
      name: 'init_workspace',
      description:
        'Create a new Epoch fractal workspace. Initializes a Git repo, writes ' +
        'manifest.json, and makes the first commit.',
      inputSchema: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Absolute path to the workspace root (created if missing)' },
          name: { type: 'string', description: 'Workspace name' },
          description: { type: 'string', description: 'Optional description' },
          authorName: { type: 'string', description: 'Git author name (default: "Epoch")' },
          authorEmail: { type: 'string', description: 'Git author email (default: "epoch@local")' },
        },
        required: ['dir', 'name'],
      },
    },
    {
      name: 'add_node',
      description:
        'Add a new research node (folder with node.json + content.tex + data/) ' +
        'inside the workspace. Pass parentPath to nest it under an existing node.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
          parentPath: {
            type: 'string',
            description: 'Workspace-relative path to the parent node folder. Omit for top-level.',
          },
          title: { type: 'string', description: 'Node title (also used to derive the folder name)' },
          description: { type: 'string', description: 'Optional description' },
          authorName: { type: 'string' },
          authorEmail: { type: 'string' },
        },
        required: ['workspaceDir', 'title'],
      },
    },
    {
      name: 'read_node',
      description: 'Read node.json from a workspace node folder.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
          nodePath: { type: 'string', description: 'Workspace-relative path to the node folder' },
        },
        required: ['workspaceDir', 'nodePath'],
      },
    },
    {
      name: 'write_node',
      description:
        'Write updated node data to node.json and create a Git commit. ' +
        'updatedAt is set automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
          nodePath: { type: 'string', description: 'Workspace-relative path to the node folder' },
          node: { type: 'object', description: 'Full ResearchNode object' },
          commitMessage: { type: 'string' },
          authorName: { type: 'string' },
          authorEmail: { type: 'string' },
        },
        required: ['workspaceDir', 'nodePath', 'node'],
      },
    },
    {
      name: 'move_node',
      description:
        'Move a node folder to a new workspace-relative path. Updates direct ' +
        'validationPath references in all other nodes automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string' },
          fromPath: { type: 'string', description: 'Current workspace-relative path' },
          toPath: { type: 'string', description: 'Destination workspace-relative path' },
          authorName: { type: 'string' },
          authorEmail: { type: 'string' },
        },
        required: ['workspaceDir', 'fromPath', 'toPath'],
      },
    },
    {
      name: 'list_nodes',
      description: 'List all research nodes in a workspace, with their paths and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'read_manifest',
      description: 'Read the workspace manifest.json.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'get_workspace_history',
      description: 'Return the full Git commit log for the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'compile_workspace',
      description:
        'Compile all nodes in a workspace to a single PDF via pdflatex in Docker. ' +
        'Nodes are included in dependency-first (topological) order. Requires Docker.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
          outputDir: { type: 'string', description: 'Where to place the PDF (defaults to workspaceDir)' },
          dockerImage: { type: 'string', description: 'Docker image with pdflatex (default: texlive/texlive:latest)' },
        },
        required: ['workspaceDir'],
      },
    },
    // ---- Phase 4: Sync ------------------------------------------------------
    {
      name: 'push_workspace',
      description:
        'Commit any unsaved workspace changes and push to the Git remote ' +
        '(Gitea or GitHub). Requires a remote named "origin" to be configured.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'pull_workspace',
      description:
        'Pull the latest commits from the Git remote into the workspace ' +
        '(fast-forward only). Fails if there are divergent local commits.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'get_remote_info',
      description: 'Return the Git remote URL, current branch, and ahead/behind counts.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'create_review',
      description:
        'Submit an in-app peer-review request to promote a node to a higher ' +
        'epistemic status. Creates a reviews/{id}.json file committed to the workspace ' +
        'repo so collaborators can see it after a pull.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
          nodePath: { type: 'string', description: 'Workspace-relative path to the node folder' },
          proposedStatus: { type: 'string', description: 'Target status (Conjecture | Hypothesis | Theorem)' },
          comment: { type: 'string', description: 'Optional note to the reviewer' },
          authorName: { type: 'string' },
          authorEmail: { type: 'string' },
        },
        required: ['workspaceDir', 'nodePath', 'proposedStatus'],
      },
    },
    {
      name: 'list_reviews',
      description: 'List all in-app peer-review requests in the workspace (newest first).',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
        },
        required: ['workspaceDir'],
      },
    },
    {
      name: 'submit_decision',
      description:
        'Approve or request changes on a pending review. Approval automatically ' +
        'promotes the node status in node.json and commits both files.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceDir: { type: 'string', description: 'Absolute path to the workspace root' },
          reviewId: { type: 'string', description: 'The review UUID (id field from list_reviews)' },
          verdict: { type: 'string', description: '"approved" or "rejected"' },
          comment: { type: 'string', description: 'Required for "rejected", optional for "approved"' },
          reviewerName: { type: 'string' },
          reviewerEmail: { type: 'string' },
        },
        required: ['workspaceDir', 'reviewId', 'verdict'],
      },
    },
    // ---- Phase 1: single project.json repos (legacy) -----------------------
    {
      name: 'init_project',
      description: '(Phase 1) Initialize a single-file Epoch project with project.json.',
      inputSchema: {
        type: 'object',
        properties: {
          dir: { type: 'string' },
          projectName: { type: 'string' },
          description: { type: 'string' },
          authorName: { type: 'string' },
          authorEmail: { type: 'string' },
        },
        required: ['dir', 'projectName'],
      },
    },
    {
      name: 'read_project',
      description: '(Phase 1) Read project.json from a single-file Epoch project.',
      inputSchema: {
        type: 'object',
        properties: { dir: { type: 'string' } },
        required: ['dir'],
      },
    },
    {
      name: 'write_project',
      description: '(Phase 1) Write project.json and commit.',
      inputSchema: {
        type: 'object',
        properties: {
          dir: { type: 'string' },
          project: { type: 'object' },
          commitMessage: { type: 'string' },
          authorName: { type: 'string' },
          authorEmail: { type: 'string' },
        },
        required: ['dir', 'project'],
      },
    },
    {
      name: 'get_history',
      description: '(Phase 1) Git log for a single-file Epoch project.',
      inputSchema: {
        type: 'object',
        properties: { dir: { type: 'string' } },
        required: ['dir'],
      },
    },
    {
      name: 'compile_project',
      description: '(Phase 1) Compile a single project.json hierarchy to PDF via Docker.',
      inputSchema: {
        type: 'object',
        properties: {
          projectJsonPath: { type: 'string' },
          outputDir: { type: 'string' },
          dockerImage: { type: 'string' },
        },
        required: ['projectJsonPath'],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  const str = (key: string): string => String(a[key]);
  const optStr = (key: string): string | undefined =>
    a[key] !== undefined ? String(a[key]) : undefined;
  const author = () => ({
    name: String(a['authorName'] ?? 'Epoch'),
    email: String(a['authorEmail'] ?? 'epoch@local'),
  });

  try {
    switch (name) {
      // ---- Phase 2 ----------------------------------------------------------
      case 'init_workspace': {
        const manifest = await initWorkspace({
          dir: str('dir'),
          name: str('name'),
          description: optStr('description'),
          author: author(),
        });
        return { content: [{ type: 'text', text: JSON.stringify(manifest, null, 2) }] };
      }

      case 'add_node': {
        const result = await addNode({
          workspaceDir: str('workspaceDir'),
          parentPath: optStr('parentPath') ?? null,
          title: str('title'),
          description: optStr('description'),
          author: author(),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ nodePath: result.nodePath, node: result.node }, null, 2),
            },
          ],
        };
      }

      case 'read_node': {
        const node = await readNode(
          `${str('workspaceDir')}/${str('nodePath')}`.replace(/\\/g, '/'),
        );
        return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
      }

      case 'write_node': {
        if (!isResearchNode(a['node'])) {
          throw new Error('Invalid node object — must satisfy the ResearchNode schema.');
        }
        await writeNode({
          workspaceDir: str('workspaceDir'),
          nodePath: str('nodePath'),
          node: a['node'],
          commitMessage: optStr('commitMessage'),
          author: author(),
        });
        return { content: [{ type: 'text', text: 'Node updated and committed.' }] };
      }

      case 'move_node': {
        await moveNode({
          workspaceDir: str('workspaceDir'),
          fromPath: str('fromPath'),
          toPath: str('toPath'),
          author: author(),
        });
        return {
          content: [
            { type: 'text', text: `Moved ${str('fromPath')} → ${str('toPath')} and committed.` },
          ],
        };
      }

      case 'list_nodes': {
        const nodes = await listNodes(str('workspaceDir'));
        return { content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }] };
      }

      case 'read_manifest': {
        const manifest = await readManifest(str('workspaceDir'));
        return { content: [{ type: 'text', text: JSON.stringify(manifest, null, 2) }] };
      }

      case 'get_workspace_history': {
        const log = await getWorkspaceHistory(str('workspaceDir'));
        const summary = log.map((c) => ({
          oid: c.oid,
          message: c.commit.message.trim(),
          author: c.commit.author,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      case 'compile_workspace': {
        const result = await compileWorkspace({
          workspaceDir: str('workspaceDir'),
          outputDir: optStr('outputDir'),
          dockerImage: optStr('dockerImage'),
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // ---- Phase 4: Sync ----------------------------------------------------
      case 'push_workspace': {
        const result = await pushWorkspace(str('workspaceDir'));
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'pull_workspace': {
        const result = await pullWorkspace(str('workspaceDir'));
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_remote_info': {
        const info = await getRemoteInfo(str('workspaceDir'));
        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
      }

      case 'create_review': {
        const review = await createReview({
          workspaceDir: str('workspaceDir'),
          nodePath: str('nodePath'),
          proposedStatus: str('proposedStatus') as Parameters<typeof createReview>[0]['proposedStatus'],
          comment: optStr('comment') ?? '',
          author: {
            name: String(a['authorName'] ?? 'Epoch'),
            email: String(a['authorEmail'] ?? 'epoch@local'),
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(review, null, 2) }] };
      }

      case 'list_reviews': {
        const reviews = await listReviews(str('workspaceDir'));
        return { content: [{ type: 'text', text: JSON.stringify(reviews, null, 2) }] };
      }

      case 'submit_decision': {
        const updated = await submitDecision({
          workspaceDir: str('workspaceDir'),
          reviewId: str('reviewId'),
          verdict: str('verdict') as 'approved' | 'rejected',
          comment: optStr('comment') ?? '',
          reviewer: {
            name: String(a['reviewerName'] ?? 'Epoch'),
            email: String(a['reviewerEmail'] ?? 'epoch@local'),
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
      }

      // ---- Phase 1 ----------------------------------------------------------
      case 'init_project': {
        const result = await initRepository({
          dir: str('dir'),
          projectName: str('projectName'),
          description: optStr('description'),
          author: author(),
        });
        return { content: [{ type: 'text', text: JSON.stringify(result.project, null, 2) }] };
      }

      case 'read_project': {
        const project = await readProject({
          dir: str('dir'),
          author: { name: 'Epoch', email: 'epoch@local' },
        });
        return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
      }

      case 'write_project': {
        if (!isProject(a['project'])) {
          throw new Error('Invalid project object.');
        }
        await writeProject(
          { dir: str('dir'), author: author() },
          a['project'],
          optStr('commitMessage'),
        );
        return { content: [{ type: 'text', text: 'Project updated and committed.' }] };
      }

      case 'get_history': {
        const log = await getHistory({
          dir: str('dir'),
          author: { name: 'Epoch', email: 'epoch@local' },
        });
        const summary = log.map((c) => ({
          oid: c.oid,
          message: c.commit.message.trim(),
          author: c.commit.author,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      case 'compile_project': {
        const result = await compileProject({
          projectJsonPath: str('projectJsonPath'),
          outputDir: optStr('outputDir'),
          dockerImage: optStr('dockerImage'),
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err: unknown) {
    if (err instanceof McpError) throw err;
    return {
      content: [{ type: 'text', text: `Error: ${String(err)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
