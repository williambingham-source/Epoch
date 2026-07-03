import { Router } from 'express';
import { AVAILABLE_PROVIDERS, activeProviderName } from '../vision/provider.js';

export function providersRouter(): Router {
  const router = Router();

  // GET /api/providers — active provider + full list
  router.get('/', (_req, res) => {
    try {
      const active = activeProviderName();
      res.json({
        active,
        model: process.env['VISION_MODEL'] ?? defaultModel(active),
        available: AVAILABLE_PROVIDERS,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}

function defaultModel(provider: string): string {
  switch (provider) {
    case 'anthropic': return 'claude-opus-4-8';
    case 'openai':    return 'gpt-4o';
    case 'gemini':    return 'gemini-2.0-flash';
    case 'ollama':    return 'llava';
    default:          return 'unknown';
  }
}
