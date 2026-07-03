import type { VisionProvider, ConvertResult } from './provider.js';
import { VISION_SYSTEM_PROMPT } from './provider.js';

export class OllamaVisionProvider implements VisionProvider {
  readonly name = 'ollama';
  private model: string;
  private baseUrl: string;

  constructor(model?: string) {
    this.model = model || process.env['VISION_MODEL'] || 'llava';
    this.baseUrl =
      process.env['OLLAMA_BASE_URL'] ?? 'http://host.docker.internal:11434';
  }

  async convertImage(imageBase64: string, hint?: string): Promise<ConvertResult> {
    const prompt = hint
      ? `${VISION_SYSTEM_PROMPT}\n\nConvert this handwritten mathematics to LaTeX. Hint: ${hint}`
      : `${VISION_SYSTEM_PROMPT}\n\nConvert this handwritten mathematics to LaTeX.`;

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        images: [imageBase64],
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { response: string };
    return {
      latex: data.response.trim(),
      confidence: 'medium',
      model: this.model,
      provider: this.name,
    };
  }
}
