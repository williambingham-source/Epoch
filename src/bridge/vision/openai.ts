import type { VisionProvider, ConvertResult } from './provider.js';
import { VISION_SYSTEM_PROMPT } from './provider.js';

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = 'openai';
  private model: string;
  private apiKey: string;

  constructor(model?: string) {
    this.model = model || process.env['VISION_MODEL'] || 'gpt-4o';
    this.apiKey = process.env['OPENAI_API_KEY'] ?? '';
    if (!this.apiKey) throw new Error('OPENAI_API_KEY env var is required for the openai provider');
  }

  async convertImage(imageBase64: string, hint?: string): Promise<ConvertResult> {
    const userText = hint
      ? `Convert this handwritten mathematics to LaTeX. Hint: ${hint}`
      : 'Convert this handwritten mathematics to LaTeX.';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
              { type: 'text', text: userText },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const latex = data.choices[0]?.message.content ?? '';

    return { latex: latex.trim(), confidence: 'high', model: this.model, provider: this.name };
  }
}
