export interface ConvertResult {
  latex: string;
  confidence: 'high' | 'medium' | 'low';
  model: string;
  provider: string;
}

export interface VisionProvider {
  readonly name: string;
  convertImage(imageBase64: string, hint?: string): Promise<ConvertResult>;
}

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'ollama';

export const AVAILABLE_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'gemini', 'ollama'];

export const VISION_SYSTEM_PROMPT = `You are a LaTeX transcription assistant for a mathematical research platform.

Given an image of handwritten or drawn mathematical content:
1. Return ONLY the LaTeX fragment — no \\documentclass, no \\begin{document}.
2. All mathematics MUST be inside math mode. Use \\[...\\] for display math and $...$ for inline math. Never leave a math symbol or expression outside of math delimiters.
3. Use these environments where appropriate: theorem, lemma, corollary, definition, proof, remark (from amsthm).
4. Use mathtools and amssymb notation. \\coloneqq is available.
5. If you cannot read a symbol clearly, write \\textbf{??} in its place.
6. Preserve the logical structure of what was drawn (proof steps, cases, etc.).
7. Return nothing except the LaTeX.`;

export async function createProvider(name: ProviderName, model?: string): Promise<VisionProvider> {
  switch (name) {
    case 'anthropic': {
      const { AnthropicVisionProvider } = await import('./anthropic.js');
      return new AnthropicVisionProvider(model);
    }
    case 'openai': {
      const { OpenAIVisionProvider } = await import('./openai.js');
      return new OpenAIVisionProvider(model);
    }
    case 'gemini': {
      const { GeminiVisionProvider } = await import('./gemini.js');
      return new GeminiVisionProvider(model);
    }
    case 'ollama': {
      const { OllamaVisionProvider } = await import('./ollama.js');
      return new OllamaVisionProvider(model);
    }
    default:
      throw new Error(`Unknown vision provider: ${String(name)}`);
  }
}

export function activeProviderName(): ProviderName {
  const v = process.env['VISION_PROVIDER'] ?? 'anthropic';
  if (!AVAILABLE_PROVIDERS.includes(v as ProviderName)) {
    throw new Error(`Invalid VISION_PROVIDER: ${v}`);
  }
  return v as ProviderName;
}
