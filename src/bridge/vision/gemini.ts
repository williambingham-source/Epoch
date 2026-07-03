import type { VisionProvider, ConvertResult } from './provider.js';
import { VISION_SYSTEM_PROMPT } from './provider.js';

export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini';
  private model: string;
  private apiKey: string;

  constructor(model?: string) {
    this.model = model ?? process.env['VISION_MODEL'] ?? 'gemini-2.0-flash';
    this.apiKey = process.env['GEMINI_API_KEY'] ?? '';
    if (!this.apiKey) throw new Error('GEMINI_API_KEY env var is required for the gemini provider');
  }

  async convertImage(imageBase64: string, hint?: string): Promise<ConvertResult> {
    const userText = hint
      ? `Convert this handwritten mathematics to LaTeX. Hint: ${hint}`
      : 'Convert this handwritten mathematics to LaTeX.';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'image/png', data: imageBase64 } },
              { text: userText },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    const latex = data.candidates[0]?.content.parts.map((p) => p.text).join('') ?? '';

    return { latex: latex.trim(), confidence: 'high', model: this.model, provider: this.name };
  }
}
