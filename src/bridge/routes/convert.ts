import * as path from 'path';
import { Router } from 'express';
import { createProvider, activeProviderName } from '../vision/provider.js';
import type { ProviderName } from '../vision/provider.js';
import { compileFragment } from '../../tools/latex-compiler.js';
import { pdfToPng } from '../utils/pdfToPng.js';
import { readUserSettings } from '../utils/userSettings.js';
import type { UserSettings } from '../utils/userSettings.js';

const USER_RE = /^[a-zA-Z0-9_.-]+$/;

export function convertRouter(workspaceDir: string): Router {
  const router = Router();

  // POST /api/convert — PNG base64 → LaTeX (+ compiled PNG preview)
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

      // Resolve per-user settings if a user header is present
      const user = req.headers['x-gitea-user'] as string | undefined;
      let userApiKey: string | undefined;
      let userProviderPref: ProviderName | undefined;

      if (user && USER_RE.test(user)) {
        const workspacesBase =
          process.env['WORKSPACES_BASE_DIR'] ??
          path.dirname(process.env['WORKSPACE_DIR'] ?? workspaceDir);
        const us = await readUserSettings(workspacesBase, user).catch((): UserSettings => ({}));
        if (us.visionProvider) userProviderPref = us.visionProvider as ProviderName;
        const resolvedProvider = providerOverride ?? userProviderPref ?? activeProviderName();
        if (resolvedProvider === 'anthropic') userApiKey = us.anthropicKey;
        else if (resolvedProvider === 'openai') userApiKey = us.openaiKey;
      }

      const providerName = providerOverride ?? userProviderPref ?? activeProviderName();
      const provider = await createProvider(providerName, model, userApiKey);
      const result = await provider.convertImage(image, hint);

      // Compile the LaTeX immediately and return a preview PNG alongside the text
      let png: string | null = null;
      try {
        const compiled = await compileFragment(result.latex, workspaceDir);
        if (compiled.success && compiled.pdfBytes) {
          png = await pdfToPng(compiled.pdfBytes);
        }
      } catch {
        // PNG preview is best-effort — LaTeX errors should not fail the convert response
      }

      res.json({ ...result, png });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
