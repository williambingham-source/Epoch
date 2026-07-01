import git from 'isomorphic-git';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import { Project, ProjectStatus, isProject } from '../types/project.js';

const PROJECT_FILE = 'project.json';

export interface GitAuthor {
  name: string;
  email: string;
}

export interface NodeRepoHandle {
  dir: string;
  author: GitAuthor;
}

export interface NodeRepoInitOptions {
  /** Absolute path to the project directory (created if missing). */
  dir: string;
  projectName: string;
  description?: string;
  author?: GitAuthor;
}

export interface NodeRepoInitResult extends NodeRepoHandle {
  project: Project;
}

// isomorphic-git accepts node:fs directly as a CallbackFsClient.
const fs = nodeFs;

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

export async function initRepository(
  opts: NodeRepoInitOptions,
): Promise<NodeRepoInitResult> {
  const {
    dir,
    projectName,
    description,
    author = { name: 'Epoch', email: 'epoch@local' },
  } = opts;

  await nodeFs.promises.mkdir(dir, { recursive: true });
  await git.init({ fs, dir });

  const project = buildInitialProject(projectName, description);
  await nodeFs.promises.writeFile(
    nodePath.join(dir, PROJECT_FILE),
    JSON.stringify(project, null, 2),
    'utf-8',
  );

  await git.add({ fs, dir, filepath: PROJECT_FILE });
  await git.commit({
    fs,
    dir,
    message: 'chore: initialize Epoch project',
    author,
  });

  return { dir, author, project };
}

export async function readProject(handle: NodeRepoHandle): Promise<Project> {
  const raw = await nodeFs.promises.readFile(
    nodePath.join(handle.dir, PROJECT_FILE),
    'utf-8',
  );
  const parsed: unknown = JSON.parse(raw);
  if (!isProject(parsed)) {
    throw new Error(`Invalid project.json in ${handle.dir}`);
  }
  return parsed;
}

export async function writeProject(
  handle: NodeRepoHandle,
  project: Project,
  commitMessage?: string,
): Promise<void> {
  const updated: Project = { ...project, updatedAt: new Date().toISOString() };

  await nodeFs.promises.writeFile(
    nodePath.join(handle.dir, PROJECT_FILE),
    JSON.stringify(updated, null, 2),
    'utf-8',
  );

  await git.add({ fs, dir: handle.dir, filepath: PROJECT_FILE });
  await git.commit({
    fs,
    dir: handle.dir,
    message: commitMessage ?? `update: project status → ${project.status}`,
    author: handle.author,
  });
}

export async function getHistory(
  handle: NodeRepoHandle,
): Promise<git.ReadCommitResult[]> {
  return git.log({ fs, dir: handle.dir });
}
