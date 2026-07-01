export interface WorkspaceAuthor {
  name: string;
  email: string;
}

export interface Manifest {
  id: string;
  name: string;
  description?: string;
  author: WorkspaceAuthor;
  createdAt: string;
}

export function isManifest(value: unknown): value is Manifest {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  const author = m['author'];
  return (
    typeof m['id'] === 'string' &&
    typeof m['name'] === 'string' &&
    typeof m['createdAt'] === 'string' &&
    typeof author === 'object' &&
    author !== null &&
    typeof (author as Record<string, unknown>)['name'] === 'string' &&
    typeof (author as Record<string, unknown>)['email'] === 'string'
  );
}
