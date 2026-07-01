/**
 * Node.js-only. Traverses the project validation hierarchy,
 * collects all .tex files, and compiles them into a single PDF
 * via pdflatex running inside a Docker container.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Project, ValidationPathItem, isProject } from '../types/project.js';
import { listNodes, readManifest } from '../core/workspace.js';
import { buildNodeMap, topologicalSort } from './dag.js';

const execAsync = promisify(exec);

const DEFAULT_DOCKER_IMAGE = 'texlive/texlive:latest';
const MASTER_TEX_FILENAME = '_epoch_master.tex';

// On Windows, Docker Desktop may not be in the PATH inherited by the
// Node.js process started by VS Code / Claude Code. Resolve the absolute
// path to docker.exe so execFile doesn't depend on PATH at all.
const WIN_DOCKER_CANDIDATES = [
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe',
];

async function resolveDockerBin(): Promise<string> {
  if (process.platform === 'win32') {
    for (const candidate of WIN_DOCKER_CANDIDATES) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // not at this location
      }
    }
  }
  return 'docker';
}

function dockerError(err: unknown, bin?: string): string {
  const e = err as { code?: string; message?: string; stdout?: string; stderr?: string };
  if (e.code === 'ENOENT') {
    return `Docker not found (tried: ${bin ?? 'docker'}). Install Docker Desktop and ensure it is running.`;
  }
  // Include pdflatex output so LaTeX errors are visible
  const out = [e.stderr, e.stdout].filter(Boolean).join('\n').slice(-3000);
  return out || e.message || String(err);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CompileOptions {
  /** Absolute or relative path to the root project.json */
  projectJsonPath: string;
  /** Where to place the final PDF. Defaults to the root project directory. */
  outputDir?: string;
  /** Docker image with pdflatex. Defaults to texlive/texlive:latest. */
  dockerImage?: string;
}

export interface CompileResult {
  success: boolean;
  outputPath?: string;
  /** All .tex files included in the build, in order. */
  texFiles: string[];
  errors: string[];
  /** Raw pdflatex stdout for diagnostics. */
  stdout?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadProject(jsonPath: string): Promise<Project> {
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!isProject(parsed)) throw new Error(`Invalid project.json: ${jsonPath}`);
  return parsed;
}

/**
 * Walks the validationPath DAG recursively, collecting every .tex file
 * found alongside each project.json, in depth-first order.
 * The `visited` set guards against cycles in the sub-project graph.
 */
async function collectTexFiles(
  projectJsonPath: string,
  validationPath: ValidationPathItem[],
  visited: Set<string> = new Set(),
): Promise<string[]> {
  const absProjectPath = path.resolve(projectJsonPath);
  const dir = path.dirname(absProjectPath);
  const texFiles: string[] = [];

  // .tex files co-located with this project.json
  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    if (entry.endsWith('.tex')) {
      texFiles.push(path.join(dir, entry));
    }
  }

  // Recurse into sub-projects referenced by validationPath
  for (const item of validationPath) {
    const subJsonPath = path.resolve(dir, item.subProjectPath);
    if (visited.has(subJsonPath)) continue;
    visited.add(subJsonPath);

    try {
      const subProject = await loadProject(subJsonPath);
      const subFiles = await collectTexFiles(
        subJsonPath,
        subProject.validationPath,
        visited,
      );
      texFiles.push(...subFiles);
    } catch {
      // Sub-project missing or malformed — skip gracefully
    }
  }

  return texFiles;
}

/**
 * Builds a minimal LaTeX master document that \input{}s every collected file.
 * Paths are relative to rootDir (the Docker /workspace mount point).
 */
function buildMasterTex(texFiles: readonly string[], rootDir: string): string {
  const inputs = texFiles
    .map((f) => `\\input{${path.relative(rootDir, f).replace(/\\/g, '/')}}`)
    .join('\n');

  return [
    '\\documentclass[12pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath,amssymb,amsthm}',
    '\\usepackage{geometry}',
    '\\geometry{margin=1in}',
    '\\usepackage{hyperref}',
    '\\newtheorem{theorem}{Theorem}[section]',
    '\\newtheorem{lemma}[theorem]{Lemma}',
    '\\newtheorem{corollary}[theorem]{Corollary}',
    '\\newtheorem{definition}[theorem]{Definition}',
    '\\newtheorem{remark}[theorem]{Remark}',
    '\\theoremstyle{remark}',
    '\\newtheorem{example}[theorem]{Example}',
    '\\setcounter{section}{0}',
    '\\begin{document}',
    inputs,
    '\\end{document}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles an Epoch project hierarchy into a single PDF.
 *
 * Requires Docker to be installed and the daemon to be running.
 * pdflatex is invoked inside the specified Docker image so no local
 * TeX installation is needed.
 */
export async function compileProject(options: CompileOptions): Promise<CompileResult> {
  const {
    projectJsonPath,
    dockerImage = DEFAULT_DOCKER_IMAGE,
  } = options;

  const absProjectPath = path.resolve(projectJsonPath);
  const rootDir = path.dirname(absProjectPath);
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : rootDir;

  const errors: string[] = [];

  // 1. Load root project and collect all .tex files
  const project = await loadProject(absProjectPath);
  const texFiles = await collectTexFiles(absProjectPath, project.validationPath);

  if (texFiles.length === 0) {
    return {
      success: false,
      texFiles,
      errors: ['No .tex files found in project hierarchy.'],
    };
  }

  // 2. Write ephemeral master.tex into the root dir
  const masterTexPath = path.join(rootDir, MASTER_TEX_FILENAME);
  await fs.writeFile(masterTexPath, buildMasterTex(texFiles, rootDir), 'utf-8');

  const outputPdfName = `${project.name.replace(/\s+/g, '_')}.pdf`;
  const generatedPdf = path.join(rootDir, MASTER_TEX_FILENAME.replace('.tex', '.pdf'));
  const finalPdf = path.join(outputDir, outputPdfName);

  const dockerBin = await resolveDockerBin();

  try {
    // 3. Run pdflatex twice (resolves cross-references)
    for (let pass = 1; pass <= 2; pass++) {
      const q = (s: string) => s.includes(' ') ? `"${s}"` : s;
      const cmd = [
        q(dockerBin), 'run', '--rm',
        '--volume', q(`${rootDir}:/workspace`),
        '--workdir', '/workspace',
        dockerImage, 'pdflatex',
        '-interaction=nonstopmode',
        '-output-directory=/workspace',
        MASTER_TEX_FILENAME,
      ].join(' ');
      const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });

      if (stderr) errors.push(`[pass ${pass}] ${stderr}`);

      if (pass === 2) {
        if (stdout.includes('No pages of output')) {
          errors.push('pdflatex produced no output — all content.tex files may be empty.');
          return { success: false, texFiles, errors };
        }
        // 4. Move to final destination
        await fs.mkdir(outputDir, { recursive: true });
        await fs.rename(generatedPdf, finalPdf);

        return {
          success: true,
          outputPath: finalPdf,
          texFiles,
          errors,
          stdout,
        };
      }
    }
  } catch (err: unknown) {
    errors.push(dockerError(err, dockerBin));
    return { success: false, texFiles, errors };
  } finally {
    // Clean up ephemeral master.tex and aux files
    const auxExtensions = ['.tex', '.aux', '.log', '.out'];
    await Promise.allSettled(
      auxExtensions.map((ext) =>
        fs.unlink(path.join(rootDir, MASTER_TEX_FILENAME.replace('.tex', ext))),
      ),
    );
  }

  // Unreachable, but satisfies TypeScript
  return { success: false, texFiles, errors: ['Unexpected compiler exit.'] };
}

// ---------------------------------------------------------------------------
// Phase 2: Fractal Workspace compiler
// ---------------------------------------------------------------------------

export interface WorkspaceCompileOptions {
  /** Absolute path to the workspace root (contains manifest.json). */
  workspaceDir: string;
  /** Where to place the final PDF. Defaults to workspaceDir. */
  outputDir?: string;
  /** Docker image with pdflatex. Defaults to texlive/texlive:latest. */
  dockerImage?: string;
}

/**
 * Compiles an entire Epoch workspace into a single PDF.
 * Walks all node.json files, topologically sorts them by validationPath
 * dependencies, then includes each node's content.tex in order.
 *
 * Requires Docker to be installed and the daemon to be running.
 */
export async function compileWorkspace(
  options: WorkspaceCompileOptions,
): Promise<CompileResult> {
  const { workspaceDir, dockerImage = DEFAULT_DOCKER_IMAGE } = options;
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : workspaceDir;
  const errors: string[] = [];

  // 1. Build node map and topologically sort
  const entries = await listNodes(workspaceDir);
  const nodeMap = buildNodeMap(entries);
  const sortedPaths = topologicalSort(nodeMap);

  if (sortedPaths === null) {
    return {
      success: false,
      texFiles: [],
      errors: ['Cycle detected in the node dependency graph.'],
    };
  }

  // 2. Collect content.tex files in dependency-first order
  const texFiles: string[] = [];
  for (const nodePath of sortedPaths) {
    const texPath = path.join(workspaceDir, nodePath, 'content.tex');
    try {
      await fs.access(texPath);
      texFiles.push(texPath);
    } catch {
      // node has no content.tex — skip
    }
  }

  if (texFiles.length === 0) {
    return {
      success: false,
      texFiles: [],
      errors: ['No content.tex files found in any workspace node.'],
    };
  }

  // 3. Write ephemeral master.tex at the workspace root
  const masterTexPath = path.join(workspaceDir, MASTER_TEX_FILENAME);
  await fs.writeFile(masterTexPath, buildMasterTex(texFiles, workspaceDir), 'utf-8');

  const manifest = await readManifest(workspaceDir);
  const outputPdfName = `${manifest.name.replace(/\s+/g, '_')}.pdf`;
  const generatedPdf = path.join(workspaceDir, MASTER_TEX_FILENAME.replace('.tex', '.pdf'));
  const finalPdf = path.join(outputDir, outputPdfName);

  const dockerBin = await resolveDockerBin();

  try {
    // 4. Run pdflatex twice inside Docker
    for (let pass = 1; pass <= 2; pass++) {
      const q = (s: string) => s.includes(' ') ? `"${s}"` : s;
      const cmd = [
        q(dockerBin), 'run', '--rm',
        '--volume', q(`${workspaceDir}:/workspace`),
        '--workdir', '/workspace',
        dockerImage, 'pdflatex',
        '-interaction=nonstopmode',
        '-output-directory=/workspace',
        MASTER_TEX_FILENAME,
      ].join(' ');
      const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });

      if (stderr) errors.push(`[pass ${pass}] ${stderr}`);

      if (pass === 2) {
        if (stdout.includes('No pages of output')) {
          errors.push('pdflatex produced no output — all content.tex files may be empty.');
          return { success: false, texFiles, errors };
        }
        await fs.mkdir(outputDir, { recursive: true });
        await fs.rename(generatedPdf, finalPdf);
        return { success: true, outputPath: finalPdf, texFiles, errors, stdout };
      }
    }
  } catch (err: unknown) {
    errors.push(dockerError(err, dockerBin));
    return { success: false, texFiles, errors };
  } finally {
    const auxExtensions = ['.tex', '.aux', '.log', '.out'];
    await Promise.allSettled(
      auxExtensions.map((ext) =>
        fs.unlink(path.join(workspaceDir, MASTER_TEX_FILENAME.replace('.tex', ext))),
      ),
    );
  }

  return { success: false, texFiles, errors: ['Unexpected compiler exit.'] };
}
