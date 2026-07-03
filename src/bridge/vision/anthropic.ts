import Anthropic from '@anthropic-ai/sdk';
import type { VisionProvider, ConvertResult } from './provider.js';
import { VISION_SYSTEM_PROMPT } from './provider.js';

export class AnthropicVisionProvider implements VisionProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(model?: string) {
    this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
    this.model = model || process.env['VISION_MODEL'] || 'claude-opus-4-8';
  }

  async convertImage(imageBase64: string, hint?: string): Promise<ConvertResult> {
    const userText = hint
      ? `Convert this handwritten mathematics to LaTeX. Hint: ${hint}`
      : 'Convert this handwritten mathematics to LaTeX.';

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    });

    const latex = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      latex: latex.trim(),
      confidence: 'high',
      model: this.model,
      provider: this.name,
    };
  }
}
