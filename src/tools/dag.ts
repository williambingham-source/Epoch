import { ResearchNode } from '../types/node.js';

export interface NodeEntry {
  path: string;
  node: ResearchNode;
}

/** Keyed by workspace-relative node path. */
export type NodeMap = Map<string, ResearchNode>;

export function buildNodeMap(entries: NodeEntry[]): NodeMap {
  return new Map(entries.map((e) => [e.path, e.node]));
}

/**
 * Kahn's algorithm. Returns workspace-relative paths in dependency-first order
 * (dependencies before the nodes that depend on them — correct LaTeX include order).
 * Returns null if a cycle is detected.
 */
export function topologicalSort(nodeMap: NodeMap): string[] | null {
  // adj[dep] = list of nodes that depend on dep
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const [p] of nodeMap) {
    adj.set(p, []);
    inDegree.set(p, 0);
  }

  for (const [nodePath, node] of nodeMap) {
    for (const dep of node.validationPath) {
      if (!nodeMap.has(dep.nodePath)) continue;
      inDegree.set(nodePath, (inDegree.get(nodePath) ?? 0) + 1);
      adj.get(dep.nodePath)!.push(nodePath);
    }
  }

  const queue: string[] = [];
  for (const [p, deg] of inDegree) {
    if (deg === 0) queue.push(p);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const dependent of adj.get(current)!) {
      const deg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) queue.push(dependent);
    }
  }

  return result.length === nodeMap.size ? result : null;
}

export function hasCycle(nodeMap: NodeMap): boolean {
  return topologicalSort(nodeMap) === null;
}

/**
 * Returns workspace-relative paths of nodes that the given node directly depends on.
 * (Items in its validationPath that exist in the nodeMap.)
 */
export function getDependencies(nodeMap: NodeMap, nodePath: string): string[] {
  return (
    nodeMap
      .get(nodePath)
      ?.validationPath.filter((d) => nodeMap.has(d.nodePath))
      .map((d) => d.nodePath) ?? []
  );
}

/**
 * Returns workspace-relative paths of nodes that directly depend on the given node.
 */
export function getDependents(nodeMap: NodeMap, nodePath: string): string[] {
  const result: string[] = [];
  for (const [p, node] of nodeMap) {
    if (node.validationPath.some((d) => d.nodePath === nodePath)) result.push(p);
  }
  return result;
}

/**
 * Traces back from a node to the top of the dependency chain (a root = no dependents).
 * Returns the path root-first, e.g. ['main-theorem', 'main-theorem/sub-lemma', targetPath].
 * Useful for breadcrumb navigation in the UI.
 */
export function pathToRoot(nodeMap: NodeMap, targetPath: string): string[] {
  if (!nodeMap.has(targetPath)) return [];

  // Build reverse map: node → nodes that depend on it
  const dependents = new Map<string, string[]>();
  for (const [p] of nodeMap) dependents.set(p, []);
  for (const [p, node] of nodeMap) {
    for (const dep of node.validationPath) {
      if (!nodeMap.has(dep.nodePath)) continue;
      dependents.get(dep.nodePath)!.push(p);
    }
  }

  function climb(current: string, visited: Set<string>): string[] {
    if (visited.has(current)) return [current]; // cycle guard
    visited.add(current);
    const parents = dependents.get(current) ?? [];
    if (parents.length === 0) return [current]; // root
    const chain = climb(parents[0]!, new Set(visited));
    return [...chain, current];
  }

  return climb(targetPath, new Set());
}
