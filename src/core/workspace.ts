import git from 'isomorphic-git';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectStatus } from '../types/project.js';
import { Manifest, isManifest } from '../types/manifest.js';
import { ResearchNode, isResearchNode } from '../types/node.js';

const MANIFEST_FILE = 'manifest.json';
const NODE_FILE = 'node.json';
const CONTENT_FILE = 'content.tex';
const DATA_DIR = 'data';
const DEFAULT_AUTHOR = { name: 'Epoch', email: 'epoch@local' };

export interface GitAuthor {
  name: string;
  email: string;
}

export interface NodeEntry {
  /** Workspace-relative POSIX path, e.g. "main-theorem/sub-lemma". */
  path: string;
  node: ResearchNode;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildInitialNode(title: string, description?: string): ResearchNode {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    description,
    status: ProjectStatus.Sketch,
    validationPath: [],
    createdAt: now,
    updatedAt: now,
  };
}

function contentTexStub(title: string): string {
  return `\\section*{${title}}\n\nWrite your content here.\n`;
}

async function getAllFilePaths(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await getAllFilePaths(full)));
    } else {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Workspace init / manifest
// ---------------------------------------------------------------------------

export interface InitWorkspaceOptions {
  dir: string;
  name: string;
  description?: string;
  author?: GitAuthor;
}

export async function initWorkspace(opts: InitWorkspaceOptions): Promise<Manifest> {
  const { dir, name, description, author = DEFAULT_AUTHOR } = opts;

  await fs.promises.mkdir(dir, { recursive: true });
  await git.init({ fs, dir });

  const manifest: Manifest = {
    id: crypto.randomUUID(),
    name,
    description,
    author,
    createdAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(
    path.join(dir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  await git.add({ fs, dir, filepath: MANIFEST_FILE });
  await git.commit({
    fs,
    dir,
    message: `chore: initialize Epoch workspace "${name}"`,
    author,
  });

  return manifest;
}

export async function readManifest(workspaceDir: string): Promise<Manifest> {
  const raw = await fs.promises.readFile(path.join(workspaceDir, MANIFEST_FILE), 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!isManifest(parsed)) throw new Error(`Invalid manifest.json in ${workspaceDir}`);
  return parsed;
}

export async function writeManifest(
  workspaceDir: string,
  manifest: Manifest,
  author: GitAuthor = DEFAULT_AUTHOR,
): Promise<void> {
  await fs.promises.writeFile(
    path.join(workspaceDir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
  await git.add({ fs, dir: workspaceDir, filepath: MANIFEST_FILE });
  await git.commit({
    fs,
    dir: workspaceDir,
    message: 'update: workspace manifest',
    author,
  });
}

// ---------------------------------------------------------------------------
// Node CRUD
// ---------------------------------------------------------------------------

export interface AddNodeOptions {
  workspaceDir: string;
  /**
   * Workspace-relative path to the parent node folder.
   * Pass null to create the node at the workspace root level.
   */
  parentPath: string | null;
  title: string;
  description?: string;
  author?: GitAuthor;
}

export interface AddNodeResult {
  node: ResearchNode;
  /** Workspace-relative POSIX path to the new node folder. */
  nodePath: string;
}

export async function addNode(opts: AddNodeOptions): Promise<AddNodeResult> {
  const { workspaceDir, parentPath, title, description, author = DEFAULT_AUTHOR } = opts;

  const slug = slugify(title);
  const relativePath = parentPath ? `${parentPath}/${slug}` : slug;
  const absoluteDir = path.join(workspaceDir, relativePath);

  // Refuse if the folder already exists — title collision at same level.
  try {
    await fs.promises.access(absoluteDir);
    throw new Error(`Node folder already exists: ${relativePath}`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  await fs.promises.mkdir(absoluteDir, { recursive: true });
  await fs.promises.mkdir(path.join(absoluteDir, DATA_DIR));

  const node = buildInitialNode(title, description);

  await fs.promises.writeFile(
    path.join(absoluteDir, NODE_FILE),
    JSON.stringify(node, null, 2),
    'utf-8',
  );

  await fs.promises.writeFile(
    path.join(absoluteDir, CONTENT_FILE),
    contentTexStub(title),
    'utf-8',
  );

  // .gitkeep so the empty data/ folder is tracked
  await fs.promises.writeFile(path.join(absoluteDir, DATA_DIR, '.gitkeep'), '', 'utf-8');

  const filesToStage = [
    `${relativePath}/${NODE_FILE}`,
    `${relativePath}/${CONTENT_FILE}`,
    `${relativePath}/${DATA_DIR}/.gitkeep`,
  ];

  try {
    for (const filepath of filesToStage) {
      await git.add({ fs, dir: workspaceDir, filepath });
    }
    await git.commit({
      fs,
      dir: workspaceDir,
      message: `add: node "${title}" at ${relativePath}`,
      author,
    });
  } catch {
    // Files are created; git commit deferred to next push
  }

  return { node, nodePath: relativePath };
}

export async function readNode(nodeDir: string): Promise<ResearchNode> {
  const raw = await fs.promises.readFile(path.join(nodeDir, NODE_FILE), 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!isResearchNode(parsed)) throw new Error(`Invalid node.json in ${nodeDir}`);
  return parsed;
}

export interface WriteNodeOptions {
  workspaceDir: string;
  /** Workspace-relative POSIX path to the node folder. */
  nodePath: string;
  node: ResearchNode;
  commitMessage?: string;
  author?: GitAuthor;
}

export async function writeNode(opts: WriteNodeOptions): Promise<void> {
  const { workspaceDir, nodePath, node, commitMessage, author = DEFAULT_AUTHOR } = opts;

  const updated: ResearchNode = { ...node, updatedAt: new Date().toISOString() };
  const absNodeDir = path.join(workspaceDir, nodePath);

  await fs.promises.writeFile(
    path.join(absNodeDir, NODE_FILE),
    JSON.stringify(updated, null, 2),
    'utf-8',
  );

  // Git operations are best-effort: the workspace may live inside a parent git
  // repo (no own .git), in which case commits are handled by the sync layer.
  try {
    await git.add({ fs, dir: workspaceDir, filepath: `${nodePath}/${NODE_FILE}` });
    await git.commit({
      fs,
      dir: workspaceDir,
      message: commitMessage ?? `update: "${node.title}" → ${node.status}`,
      author,
    });
  } catch {
    // File is saved; git commit deferred to next push
  }
}

// ---------------------------------------------------------------------------
// Listing / traversal
// ---------------------------------------------------------------------------

export async function listNodes(workspaceDir: string): Promise<NodeEntry[]> {
  const results: NodeEntry[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const entryDir = path.join(dir, entry.name);
      try {
        const raw = await fs.promises.readFile(path.join(entryDir, NODE_FILE), 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        if (isResearchNode(parsed)) {
          results.push({
            path: path.relative(workspaceDir, entryDir).replace(/\\/g, '/'),
            node: parsed,
          });
        }
      } catch {
        // not a node folder — recurse anyway in case sub-nodes are nested inside
      }
      await walk(entryDir);
    }
  }

  await walk(workspaceDir);
  return results;
}

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

export interface MoveNodeOptions {
  workspaceDir: string;
  /** Workspace-relative POSIX path of the node to move. */
  fromPath: string;
  /** Workspace-relative POSIX destination path. */
  toPath: string;
  author?: GitAuthor;
}

export async function moveNode(opts: MoveNodeOptions): Promise<void> {
  const { workspaceDir, fromPath, toPath, author = DEFAULT_AUTHOR } = opts;

  const oldAbsDir = path.join(workspaceDir, fromPath);
  const newAbsDir = path.join(workspaceDir, toPath);

  // Stage removal of all files at old location
  const oldFiles = await getAllFilePaths(oldAbsDir);
  for (const file of oldFiles) {
    await git.remove({
      fs,
      dir: workspaceDir,
      filepath: path.relative(workspaceDir, file).replace(/\\/g, '/'),
    });
  }

  // Move on disk
  await fs.promises.mkdir(path.dirname(newAbsDir), { recursive: true });
  await fs.promises.rename(oldAbsDir, newAbsDir);

  // Stage all files at new location
  const newFiles = await getAllFilePaths(newAbsDir);
  for (const file of newFiles) {
    await git.add({
      fs,
      dir: workspaceDir,
      filepath: path.relative(workspaceDir, file).replace(/\\/g, '/'),
    });
  }

  // Update direct validationPath references in all other nodes
  const allNodes = await listNodes(workspaceDir);
  for (const entry of allNodes) {
    const needsUpdate = entry.node.validationPath.some((d) => d.nodePath === fromPath);
    if (!needsUpdate) continue;

    const updatedNode: ResearchNode = {
      ...entry.node,
      validationPath: entry.node.validationPath.map((d) =>
        d.nodePath === fromPath ? { ...d, nodePath: toPath } : d,
      ),
      updatedAt: new Date().toISOString(),
    };

    const absNodeFile = path.join(workspaceDir, entry.path, NODE_FILE);
    await fs.promises.writeFile(absNodeFile, JSON.stringify(updatedNode, null, 2), 'utf-8');
    await git.add({
      fs,
      dir: workspaceDir,
      filepath: `${entry.path}/${NODE_FILE}`,
    });
  }

  await git.commit({
    fs,
    dir: workspaceDir,
    message: `move: ${fromPath} → ${toPath}`,
    author,
  });
}

// ---------------------------------------------------------------------------
// History (delegates to git log on the workspace root)
// ---------------------------------------------------------------------------

export async function getWorkspaceHistory(
  workspaceDir: string,
): Promise<git.ReadCommitResult[]> {
  return git.log({ fs, dir: workspaceDir });
}
