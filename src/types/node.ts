import { ProjectStatus } from './project.js';

export interface NodeDependency {
  title: string;
  status: ProjectStatus;
  /** Workspace-relative path to the dependency's folder (e.g. "lemma-a/axiom-1"). */
  nodePath: string;
}

export interface ResearchNode {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  /** Ordered list of nodes this node depends on for validation. Forms the DAG edges. */
  validationPath: NodeDependency[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function isResearchNode(value: unknown): value is ResearchNode {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Record<string, unknown>;
  return (
    typeof n['id'] === 'string' &&
    typeof n['title'] === 'string' &&
    typeof n['status'] === 'string' &&
    Object.values(ProjectStatus).includes(n['status'] as ProjectStatus) &&
    Array.isArray(n['validationPath'])
  );
}
