export interface NodeSummary {
  path: string;
  title: string;
  status: string;
  tags: string[];
}

export interface NodeDetail {
  path: string;
  node: {
    title: string;
    status: string;
    description?: string;
    tags: string[];
    validationPath: unknown[];
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

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res;
}

export async function listNodes(): Promise<NodeSummary[]> {
  return (await apiFetch('/api/nodes')).json();
}

export async function getManifest(): Promise<Manifest> {
  return (await apiFetch('/api/nodes/manifest')).json();
}

export async function getNode(path: string): Promise<NodeDetail> {
  return (await apiFetch(`/api/nodes/${encodeURIComponent(path)}`)).json();
}

export interface UpdateNodeOpts {
  latex?: string;
  title?: string;
  status?: string;
  description?: string;
  tags?: string[];
  commitMessage?: string;
}

export async function updateNode(path: string, opts: UpdateNodeOpts): Promise<void> {
  await apiFetch(`/api/nodes/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitMessage: 'update via epoch-web', ...opts }),
  });
}

export async function createNode(parentPath: string, title: string): Promise<{ path: string; title: string }> {
  return (await apiFetch('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, title }),
  })).json();
}

export async function deleteNode(path: string): Promise<void> {
  await apiFetch(`/api/nodes/${encodeURIComponent(path)}`, { method: 'DELETE' });
}

export async function moveNode(fromPath: string, toPath: string): Promise<string> {
  const res = await apiFetch(`/api/nodes/${encodeURIComponent(fromPath)}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toPath }),
  });
  const data = await res.json() as { path: string };
  return data.path;
}

// ---------------------------------------------------------------------------
// File manager
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
  return (await apiFetch(`/api/files/list?dir=${encodeURIComponent(dir)}`)).json();
}

export async function readFsFile(path: string): Promise<FsFileContent> {
  return (await apiFetch(`/api/files/read?path=${encodeURIComponent(path)}`)).json();
}

export async function uploadFile(dir: string, file: File): Promise<void> {
  const content = await fileToBase64(file);
  await apiFetch('/api/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, name: file.name, content }),
  });
}

export async function createFsFile(path: string, content = ''): Promise<void> {
  await apiFetch('/api/files/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
}

export async function createFsDir(path: string): Promise<void> {
  await apiFetch('/api/files/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export async function deleteFsEntry(path: string): Promise<void> {
  await apiFetch('/api/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export async function renameFsEntry(from: string, to: string): Promise<void> {
  await apiFetch('/api/files/rename', {
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
// Git history
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
  return (await apiFetch(`/api/nodes/log?${params}`)).json();
}

export async function compileLatex(latex: string): Promise<Blob> {
  const res = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latex }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(err.error ?? `Compile failed: ${res.status}`);
  }
  return res.blob();
}
