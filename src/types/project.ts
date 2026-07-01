/**
 * The epistemic status of a project node in the validation hierarchy.
 * Ordered from weakest (Sketch) to strongest (Theorem).
 */
export enum ProjectStatus {
  Sketch = 'Sketch',
  Conjecture = 'Conjecture',
  Hypothesis = 'Hypothesis',
  Theorem = 'Theorem',
}

/**
 * A single step in the validation chain.
 * subProjectPath is a relative path to the sub-project's project.json,
 * allowing the hierarchy to be traversed recursively.
 */
export interface ValidationPathItem {
  title: string;
  status: ProjectStatus;
  /** Relative path from this project.json to the linked sub-project's project.json */
  subProjectPath: string;
}

/**
 * The schema for project.json — the single source of truth for an Epoch project node.
 */
export interface Project {
  /** UUIDv4 assigned at creation */
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  /**
   * Ordered list of validation steps. Each step may link to a sub-project,
   * forming a directed acyclic graph of claims.
   */
  validationPath: ValidationPathItem[];
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Utility: a Project with all optional fields resolved (useful for display layers) */
export type ResolvedProject = Required<Project>;

/** Type guard */
export function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p['id'] === 'string' &&
    typeof p['name'] === 'string' &&
    typeof p['status'] === 'string' &&
    Object.values(ProjectStatus).includes(p['status'] as ProjectStatus) &&
    Array.isArray(p['validationPath'])
  );
}
