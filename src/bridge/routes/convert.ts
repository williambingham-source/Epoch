import { Router } from 'express';
import { createProvider, activeProviderName } from '../vision/provider.js';
import type { ProviderName } from '../vision/provider.js';

export function convertRouter(): Router {
  const router = Router();

  // POST /api/convert — PNG base64 → LaTeX via vision provider
  router.post('/', async (req, res) => {
    try {
      const { image, hint, provider: providerOverride, model } = req.body as {
        image: string;
        hint?: string;
        provider?: ProviderName;
        model?: string;
      };

      if (!image) {
        res.status(400).json({ error: 'image field (base64 PNG) is required' });
        return;
      }

      const providerName = providerOverride ?? activeProviderName();
      const provider = await createProvider(providerName, model);
      const result = await provider.convertImage(image, hint);

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
