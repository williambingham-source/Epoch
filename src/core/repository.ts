import git from 'isomorphic-git';
import LightningFS from '@isomorphic-git/lightning-fs';
import { Project, ProjectStatus, isProject } from '../types/project.js';

const DEFAULT_FS_NAME = 'epoch-fs';
const PROJECT_FILE = 'project.json';

export interface GitAuthor {
  name: string;
  email: string;
}

export interface RepoInitOptions {
  projectName: string;
  description?: string;
  /** Shared IndexedDB bucket name. Defaults to "epoch-fs". */
  fsName?: string;
  author?: GitAuthor;
}

export interface RepoHandle {
  fs: LightningFS;
  dir: string;
  author: GitAuthor;
}

export interface RepoInitResult extends RepoHandle {
  project: Project;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function ensureDir(pfs: LightningFS['promises'], dir: string): Promise<void> {
  try {
    await pfs.mkdir(dir);
  } catch (err: unknown) {
    // EEXIST is fine — the directory already exists
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
}

function buildInitialProject(name: string, description?: string): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    description,
    status: ProjectStatus.Sketch,
    validationPath: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialises a new Epoch project inside an IndexedDB-backed Git repository.
 * Safe to call in any browser context; LightningFS handles the persistence layer.
 */
export async function initRepository(options: RepoInitOptions): Promise<RepoInitResult> {
  const {
    projectName,
    description,
    fsName = DEFAULT_FS_NAME,
    author = { name: 'Epoch', email: 'epoch@local' },
  } = options;

  const fs = new LightningFS(fsName);
  const pfs = fs.promises;
  const dir = `/${projectName}`;

  await ensureDir(pfs, dir);
  await git.init({ fs, dir });

  const project = buildInitialProject(projectName, description);
  await pfs.writeFile(
    `${dir}/${PROJECT_FILE}`,
    JSON.stringify(project, null, 2),
    'utf8',
  );

  await git.add({ fs, dir, filepath: PROJECT_FILE });
  await git.commit({
    fs,
    dir,
    message: 'chore: initialize Epoch project',
    author,
  });

  return { fs, dir, author, project };
}

/**
 * Opens an existing repository. Throws if project.json is missing or malformed.
 */
export async function openRepository(
  projectName: string,
  fsName = DEFAULT_FS_NAME,
  author: GitAuthor = { name: 'Epoch', email: 'epoch@local' },
): Promise<RepoHandle> {
  const fs = new LightningFS(fsName);
  const dir = `/${projectName}`;
  // Validate the repo exists by reading project.json
  await readProject({ fs, dir, author });
  return { fs, dir, author };
}

/**
 * Reads and parses project.json from the repo root.
 */
export async function readProject(handle: RepoHandle): Promise<Project> {
  const raw = await handle.fs.promises.readFile(
    `${handle.dir}/${PROJECT_FILE}`,
    'utf8',
  );
  const parsed: unknown = JSON.parse(raw as string);
  if (!isProject(parsed)) {
    throw new Error(`Invalid project.json in ${handle.dir}`);
  }
  return parsed;
}

/**
 * Writes an updated project.json and creates a Git commit.
 * The updatedAt timestamp is set automatically.
 */
export async function writeProject(
  handle: RepoHandle,
  project: Project,
  commitMessage?: string,
): Promise<void> {
  const updated: Project = { ...project, updatedAt: new Date().toISOString() };

  await handle.fs.promises.writeFile(
    `${handle.dir}/${PROJECT_FILE}`,
    JSON.stringify(updated, null, 2),
    'utf8',
  );

  await git.add({ fs: handle.fs, dir: handle.dir, filepath: PROJECT_FILE });
  await git.commit({
    fs: handle.fs,
    dir: handle.dir,
    message: commitMessage ?? `update: project status → ${project.status}`,
    author: handle.author,
  });
}

/**
 * Returns the full Git commit log for the project.
 */
export async function getHistory(
  handle: RepoHandle,
): Promise<git.ReadCommitResult[]> {
  return git.log({ fs: handle.fs, dir: handle.dir });
}
