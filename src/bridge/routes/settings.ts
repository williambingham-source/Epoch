import { Router } from 'express';
import { readUserSettings, writeUserSettings, maskSettings } from '../utils/userSettings.js';

const USER_RE = /^[a-zA-Z0-9_.-]+$/;

export function settingsRouter(baseDir: string): Router {
  const router = Router();

  // GET /api/settings
  router.get('/', async (req, res) => {
    const user = req.headers['x-gitea-user'] as string | undefined;
    if (!user || !USER_RE.test(user)) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    try {
      const settings = await readUserSettings(baseDir, user);
      res.json(maskSettings(settings));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/settings
  router.put('/', async (req, res) => {
    const user = req.headers['x-gitea-user'] as string | undefined;
    if (!user || !USER_RE.test(user)) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    try {
      const { anthropicKey, openaiKey, visionProvider } = req.body as {
        anthropicKey?: string | null;
        openaiKey?: string | null;
        visionProvider?: string;
      };
      await writeUserSettings(baseDir, user, { anthropicKey, openaiKey, visionProvider });
      const updated = await readUserSettings(baseDir, user);
      res.json(maskSettings(updated));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
