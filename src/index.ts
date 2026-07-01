// Core types — safe in any environment (browser or Node)
export type {
  Project,
  ResolvedProject,
  ValidationPathItem,
} from './types/project.js';
export { ProjectStatus, isProject } from './types/project.js';

// Repository operations — browser-safe (uses IndexedDB via LightningFS)
export type {
  GitAuthor,
  RepoInitOptions,
  RepoHandle,
  RepoInitResult,
} from './core/repository.js';
export {
  initRepository,
  openRepository,
  readProject,
  writeProject,
  getHistory,
} from './core/repository.js';

// Phase 2 types — safe in any environment
export type { Manifest, WorkspaceAuthor } from './types/manifest.js';
export { isManifest } from './types/manifest.js';

export type { ResearchNode, NodeDependency } from './types/node.js';
export { isResearchNode } from './types/node.js';

// LaTeX compiler — Node.js only (uses child_process + Docker)
// Import separately in server/CLI contexts:
//   import { compileProject, compileWorkspace } from 'epoch/tools/latex-compiler'
export type {
  CompileOptions,
  CompileResult,
  WorkspaceCompileOptions,
} from './tools/latex-compiler.js';
