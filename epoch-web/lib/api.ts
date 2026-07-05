// ---------------------------------------------------------------------------
// API base — set this before making any workspace-scoped calls.
// For /ws/[name] routes this is set to /ws/<name>/api.
// For the legacy /workspace route it stays at /api.
// ---------------------------------------------------------------------------
let _apiBase = '/api';

export function setApiBase(base: string) {
  _apiBase = base;
}

export function getApiBase() {
  return _apiBase;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationPathEntry {
  nodePath: string;
  title: string;
  status: string;
}

export interface NodeSummary {
  path: string;
  title: string;
  status: string;
  tags: string[];
  validationPath: ValidationPathEntry[];
}

export interface NodeDetail {
  path: string;
  node: {
    title: string;
    status: string;
    description?: string;
    tags: string[];
    validationPath: ValidationPathEntry[];
    createdAt: string;
    updatedAt: string;
  };
  latex: string;
}

export interface Manifest {
  name: string;
  description?: string;
  createdAt: string;
}

export interface WorkspaceSummary {
  name: string;
  displayName: string;
  description?: string;
  nodeCount: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Workspace management (not scoped — always uses /api)
// ---------------------------------------------------------------------------

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return (await apiFetch('/api/workspaces')).json();
}

export async function createWorkspace(
  name: string,
  displayName: string,
  description?: string,
): Promise<{ name: string; displayName: string }> {
  return (
    await apiFetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, displayName, description }),
    })
  ).json();
}

// ---------------------------------------------------------------------------
// Node API (workspace-scoped via _apiBase)
// ---------------------------------------------------------------------------

export function getThumbnailUrl(nodePath: string): string {
  return `${_apiBase}/nodes/${encodeURIComponent(nodePath)}/thumbnail`;
}

export async function listNodes(): Promise<NodeSummary[]> {
  return (await apiFetch(`${_apiBase}/nodes`)).json();
}

export async function getManifest(): Promise<Manifest> {
  return (await apiFetch(`${_apiBase}/nodes/manifest`)).json();
}

export async function getNode(path: string): Promise<NodeDetail> {
  return (await apiFetch(`${_apiBase}/nodes/${encodeURIComponent(path)}`)).json();
}

export interface UpdateNodeOpts {
  latex?: string;
  title?: string;
  status?: string;
  description?: string;
  tags?: string[];
  validationPath?: ValidationPathEntry[];
  commitMessage?: string;
}

export async function updateNode(path: string, opts: UpdateNodeOpts): Promise<void> {
  await apiFetch(`${_apiBase}/nodes/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitMessage: 'update via epoch-web', ...opts }),
  });
}

export async function createNode(
  parentPath: string,
  title: string,
): Promise<{ path: string; title: string }> {
  return (
    await apiFetch(`${_apiBase}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath, title }),
    })
  ).json();
}

export async function deleteNode(path: string): Promise<void> {
  await apiFetch(`${_apiBase}/nodes/${encodeURIComponent(path)}`, { method: 'DELETE' });
}

export async function moveNode(fromPath: string, toPath: string): Promise<string> {
  const res = await apiFetch(`${_apiBase}/nodes/${encodeURIComponent(fromPath)}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toPath }),
  });
  const data = (await res.json()) as { path: string };
  return data.path;
}

// ---------------------------------------------------------------------------
// File manager (workspace-scoped)
// ---------------------------------------------------------------------------

export interface FsEntry {
  name: string;
  isDir: boolean;
  path: string;
}

export interface FsFileContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
}

export async function listFiles(dir = ''): Promise<FsEntry[]> {
  return (await apiFetch(`${_apiBase}/files/list?dir=${encodeURIComponent(dir)}`)).json();
}

export async function readFsFile(path: string): Promise<FsFileContent> {
  return (await apiFetch(`${_apiBase}/files/read?path=${encodeURIComponent(path)}`)).json();
}

export async function uploadFile(dir: string, file: File): Promise<void> {
  const content = await fileToBase64(file);
  await apiFetch(`${_apiBase}/files/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, name: file.name, content }),
  });
}

export async function createFsFile(path: string, content = ''): Promise<void> {
  await apiFetch(`${_apiBase}/files/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
}

export async function createFsDir(path: string): Promise<void> {
  await apiFetch(`${_apiBase}/files/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export async function deleteFsEntry(path: string): Promise<void> {
  await apiFetch(`${_apiBase}/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export async function renameFsEntry(from: string, to: string): Promise<void> {
  await apiFetch(`${_apiBase}/files/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Git history (workspace-scoped)
// ---------------------------------------------------------------------------

export interface CommitEntry {
  hash: string;
  message: string;
  author: string;
  timestamp: number; // Unix seconds
}

export async function getNodeLog(nodePath: string, limit = 50): Promise<CommitEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (nodePath) params.set('path', nodePath);
  return (await apiFetch(`${_apiBase}/nodes/log?${params}`)).json();
}

// ---------------------------------------------------------------------------
// Compile (workspace-scoped)
// ---------------------------------------------------------------------------

export async function compileLatex(latex: string): Promise<Blob> {
  const res = await fetch(`${_apiBase}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latex }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
      error?: string;
    };
    throw new Error(err.error ?? `Compile failed: ${res.status}`);
  }
  return res.blob();
}
