import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const BRIDGE_TOOLS: Tool[] = [
  {
    name: 'convert_ink',
    description:
      'Convert a base64-encoded PNG image of handwritten or drawn mathematics into a LaTeX fragment.',
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base64-encoded PNG of the handwriting/diagram' },
        hint: { type: 'string', description: 'Optional context hint for the model (e.g. "proof step involving continued fractions")' },
        provider: { type: 'string', enum: ['anthropic', 'openai', 'gemini', 'ollama'], description: 'Override the active vision provider for this call' },
        model: { type: 'string', description: 'Override the model within the chosen provider' },
      },
      required: ['image'],
    },
  },
  {
    name: 'compile_latex',
    description: 'Compile a LaTeX fragment using the Epoch preamble. Returns the PDF as a base64 string.',
    inputSchema: {
      type: 'object',
      properties: {
        latex: { type: 'string', description: 'LaTeX fragment (no \\documentclass or \\begin{document})' },
      },
      required: ['latex'],
    },
  },
  {
    name: 'list_nodes',
    description: 'List all nodes in the active Epoch workspace.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_node',
    description: 'Get a node\'s metadata and content.tex source.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the node from the workspace root (e.g. "proof/lemma-a")' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_node',
    description: 'Create a new Epoch node, optionally with LaTeX content and a source ink image.',
    inputSchema: {
      type: 'object',
      properties: {
        parentPath: { type: 'string', description: 'Relative path to the parent node (empty string for workspace root)' },
        title: { type: 'string', description: 'Node title' },
        status: { type: 'string', enum: ['Sketch', 'Conjecture', 'Hypothesis', 'Theorem'] },
        latex: { type: 'string', description: 'Initial content.tex content' },
        inkPng: { type: 'string', description: 'Base64 PNG of source ink to archive in data/source-ink.png' },
      },
      required: ['parentPath', 'title'],
    },
  },
  {
    name: 'update_node',
    description: 'Update the content.tex of an existing node.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the node' },
        latex: { type: 'string', description: 'New content.tex content' },
        commitMessage: { type: 'string', description: 'Optional git commit message' },
      },
      required: ['path', 'latex'],
    },
  },
  {
    name: 'get_node_pdf',
    description: 'Compile a node\'s content.tex and return the PDF as a base64 string.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the node' },
      },
      required: ['path'],
    },
  },
  {
    name: 'open_in_canvas',
    description: 'Generate the Excalidraw deep-link URL to open a node in the canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the node' },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_vision_providers',
    description: 'List available vision providers and the currently active one.',
    inputSchema: { type: 'object', properties: {} },
  },
];
