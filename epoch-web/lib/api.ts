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

export async function updateNode(path: string, latex: string): Promise<void> {
  await apiFetch(`/api/nodes/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latex, commitMessage: 'update via epoch-web' }),
  });
}

export async function createNode(parentPath: string, title: string): Promise<{ path: string; title: string }> {
  return (await apiFetch('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, title }),
  })).json();
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
