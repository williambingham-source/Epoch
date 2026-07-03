import * as vscode from 'vscode';
import * as nodePath from 'node:path';
import * as nodeFs from 'node:fs/promises';
import {
  initWorkspace,
  addNode,
  writeNode,
  listNodes,
  readManifest,
} from '../core/workspace.js';
import { compileWorkspace } from '../tools/latex-compiler.js';
import { getRemoteInfo, pushWorkspace, pullWorkspace } from '../core/sync.js';
import { listReviews, createReview, submitDecision } from '../core/reviews.js';
import { runGit, findGitRoot } from '../core/_git.js';
import type { ToExtension, ToWebview, ResearchNode, ProjectStatus } from '../webview/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.css'),
  );
  const workerUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'pdf.worker.min.mjs'),
  );
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}' ${webview.cspSource};
             worker-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Epoch</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__PDFJS_WORKER_SRC__ = "${workerUri}";</script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

async function hasManifest(dir: string): Promise<boolean> {
  try {
    await nodeFs.access(nodePath.join(dir, 'manifest.json'));
    return true;
  } catch {
    return false;
  }
}

/** Read the git user identity for the workspace, falling back to the manifest author. */
async function getIdentity(
  workspaceDir: string,
): Promise<{ name: string; email: string }> {
  try {
    const root = (await findGitRoot(workspaceDir)) ?? workspaceDir;
    const [nameRes, emailRes] = await Promise.allSettled([
      runGit(['config', 'user.name'], root),
      runGit(['config', 'user.email'], root),
    ]);
    const name = nameRes.status === 'fulfilled' ? nameRes.value.stdout.trim() : '';
    const email = emailRes.status === 'fulfilled' ? emailRes.value.stdout.trim() : '';
    if (name && email) return { name, email };
  } catch { /* fall through */ }
  try {
    const manifest = await readManifest(workspaceDir);
    return manifest.author;
  } catch { /* fall through */ }
  return { name: 'Epoch User', email: 'user@local' };
}

// ---------------------------------------------------------------------------
// Workspace selection / initialisation
// ---------------------------------------------------------------------------

async function resolveWorkspaceDir(): Promise<string | undefined> {
  // Fast path: current VS Code workspace root already has a manifest
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (wsFolder && (await hasManifest(wsFolder.uri.fsPath))) {
    return wsFolder.uri.fsPath;
  }

  // Prompt
  const choice = await vscode.window.showQuickPick(
    [
      { label: '$(folder-opened) Open existing workspace', value: 'open' as const },
      {
        label: '$(add) Initialize new workspace here',
        value: 'init' as const,
        description: wsFolder?.uri.fsPath,
      },
    ],
    { placeHolder: 'No Epoch workspace found — what would you like to do?' },
  );

  if (!choice) return;

  if (choice.value === 'open') {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Epoch Workspace',
    });
    return uris?.[0]?.fsPath;
  }

  // init
  if (!wsFolder) {
    void vscode.window.showErrorMessage('Open a folder in VS Code first.');
    return;
  }
  const name = await vscode.window.showInputBox({
    prompt: 'Workspace name',
    value: nodePath.basename(wsFolder.uri.fsPath),
  });
  if (!name) return;
  const authorName = await vscode.window.showInputBox({
    prompt: 'Your name',
    value: 'Epoch User',
  });
  const authorEmail = await vscode.window.showInputBox({
    prompt: 'Your email',
    value: 'user@local',
  });
  await initWorkspace({
    dir: wsFolder.uri.fsPath,
    name,
    author: { name: authorName ?? 'Epoch User', email: authorEmail ?? 'user@local' },
  });
  return wsFolder.uri.fsPath;
}

// ---------------------------------------------------------------------------
// Webview panel
// ---------------------------------------------------------------------------

async function sendInit(panel: vscode.WebviewPanel, workspaceDir: string): Promise<void> {
  const [manifest, nodes, reviews] = await Promise.all([
    readManifest(workspaceDir),
    listNodes(workspaceDir),
    listReviews(workspaceDir),
  ]);
  const msg: ToWebview = { type: 'init', workspaceDir, manifest, nodes, reviews };
  void panel.webview.postMessage(msg);
}

function createPanel(context: vscode.ExtensionContext, workspaceDir: string): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'epoch',
    'Epoch',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
    },
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  panel.webview.onDidReceiveMessage(
    async (raw: unknown) => {
      const msg = raw as ToExtension;
      try {
        switch (msg.type) {
          case 'ready':
            await sendInit(panel, workspaceDir);
            // Send remote info asynchronously (may do a git fetch)
            void getRemoteInfo(workspaceDir).then((info) => {
              void panel.webview.postMessage({ type: 'remoteInfo', info } satisfies ToWebview);
            });
            break;

          case 'saveNode': {
            await writeNode({
              workspaceDir,
              nodePath: msg.nodePath,
              node: msg.node as ResearchNode as Parameters<typeof writeNode>[0]['node'],
            });
            const nodes = await listNodes(workspaceDir);
            void panel.webview.postMessage({ type: 'nodes', nodes } satisfies ToWebview);
            break;
          }

          case 'addNode': {
            await addNode({
              workspaceDir,
              parentPath: msg.parentPath,
              title: msg.title,
              description: msg.description,
            });
            const nodes = await listNodes(workspaceDir);
            void panel.webview.postMessage({ type: 'nodes', nodes } satisfies ToWebview);
            break;
          }

          case 'compile': {
            const result = await compileWorkspace({ workspaceDir });
            void panel.webview.postMessage({ type: 'compileResult', result } satisfies ToWebview);
            if (result.success && result.outputPath) {
              try {
                const buf = await nodeFs.readFile(result.outputPath);
                void panel.webview.postMessage({
                  type: 'pdfData',
                  base64: buf.toString('base64'),
                  fileName: nodePath.basename(result.outputPath),
                } satisfies ToWebview);
              } catch {
                // Non-fatal: compile result already sent
              }
            }
            break;
          }

          case 'openFolder': {
            const uri = vscode.Uri.file(nodePath.join(workspaceDir, msg.nodePath));
            await vscode.commands.executeCommand('revealInExplorer', uri);
            break;
          }

          case 'navigateTo':
            // Navigation is managed client-side; no server action needed.
            break;

          case 'sync': {
            const syncFn = msg.action === 'push' ? pushWorkspace : pullWorkspace;
            const result = await syncFn(workspaceDir);
            void panel.webview.postMessage({
              type: 'syncResult',
              result,
              action: msg.action,
            } satisfies ToWebview);
            // After pull, refresh nodes and reviews in case they changed
            if (msg.action === 'pull') {
              const [nodes, reviews] = await Promise.all([
                listNodes(workspaceDir),
                listReviews(workspaceDir),
              ]);
              void panel.webview.postMessage({ type: 'nodes', nodes } satisfies ToWebview);
              void panel.webview.postMessage({ type: 'reviews', reviews } satisfies ToWebview);
            }
            void getRemoteInfo(workspaceDir).then((info) => {
              void panel.webview.postMessage({ type: 'remoteInfo', info } satisfies ToWebview);
            });
            break;
          }

          case 'getRemoteInfo': {
            const info = await getRemoteInfo(workspaceDir);
            void panel.webview.postMessage({ type: 'remoteInfo', info } satisfies ToWebview);
            break;
          }

          case 'openExternal': {
            void vscode.env.openExternal(vscode.Uri.parse(msg.url));
            break;
          }

          case 'createReview': {
            const author = await getIdentity(workspaceDir);
            const review = await createReview({
              workspaceDir,
              nodePath: msg.nodePath,
              proposedStatus: msg.proposedStatus as Parameters<typeof createReview>[0]['proposedStatus'],
              comment: msg.comment,
              author,
            });
            const reviews = await listReviews(workspaceDir);
            void panel.webview.postMessage({ type: 'reviews', reviews } satisfies ToWebview);
            // Auto-push so the review reaches collaborators
            void pushWorkspace(workspaceDir).catch(() => { /* non-fatal */ });
            void review; // used above via listReviews
            break;
          }

          case 'submitDecision': {
            const reviewer = await getIdentity(workspaceDir);
            await submitDecision({
              workspaceDir,
              reviewId: msg.reviewId,
              verdict: msg.verdict,
              comment: msg.comment,
              reviewer,
            });
            // Refresh both reviews and nodes (node status may have changed on approval)
            const [nodes, reviews] = await Promise.all([
              listNodes(workspaceDir),
              listReviews(workspaceDir),
            ]);
            void panel.webview.postMessage({ type: 'nodes', nodes } satisfies ToWebview);
            void panel.webview.postMessage({ type: 'reviews', reviews } satisfies ToWebview);
            // Auto-push so the decision reaches collaborators
            void pushWorkspace(workspaceDir).catch(() => { /* non-fatal */ });
            break;
          }
        }
      } catch (err: unknown) {
        void panel.webview.postMessage({
          type: 'error',
          message: String(err),
        } satisfies ToWebview);
      }
    },
    undefined,
    context.subscriptions,
  );

  return panel;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('epoch.openWorkspace', async () => {
    const workspaceDir = await resolveWorkspaceDir();
    if (!workspaceDir) return;
    createPanel(context, workspaceDir);
  });

  context.subscriptions.push(command);
}

export function deactivate(): void {}
