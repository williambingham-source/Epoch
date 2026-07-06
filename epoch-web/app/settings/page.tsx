'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface MaskedSettings {
  anthropicKeySet: boolean;
  openaiKeySet: boolean;
  visionProvider: string;
}

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai',    label: 'OpenAI (GPT-4o)' },
  { value: 'gemini',    label: 'Google Gemini' },
  { value: 'ollama',    label: 'Ollama (local)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [masked, setMasked] = useState<MaskedSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state — empty means "don't change"; non-empty means "update"
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [visionProvider, setVisionProvider] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: MaskedSettings) => {
        setMasked(data);
        setVisionProvider(data.visionProvider);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load settings'));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string | null> = { visionProvider };
      // Only send a key if the user typed one; null means "clear", omit means "keep"
      // We use empty string as "don't change" sentinel (not sent)
      if (anthropicKey !== '') body['anthropicKey'] = anthropicKey || null;
      if (openaiKey !== '') body['openaiKey'] = openaiKey || null;

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: MaskedSettings = await res.json();
      if (!res.ok) {
        setSaveMsg({ ok: false, text: (data as unknown as { error: string }).error ?? 'Save failed' });
      } else {
        setMasked(data);
        setAnthropicKey('');
        setOpenaiKey('');
        setSaveMsg({ ok: true, text: 'Settings saved.' });
      }
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sp-root">
      <div className="sp-header">
        <button className="sp-back" onClick={() => router.push('/')}>
          ← Workspaces
        </button>
        <div className="sp-header-center">
          <span className="sp-logo-mark">⬡</span>
          <span className="sp-title">Settings</span>
        </div>
        <div className="sp-header-right">
          {session?.user?.name && (
            <span className="sp-user">{session.user.name}</span>
          )}
        </div>
      </div>

      <div className="sp-body">
        {loadError && (
          <div className="sp-error">
            Could not load settings: {loadError}
          </div>
        )}

        {!loadError && (
          <form onSubmit={handleSave} className="sp-form">
            {/* Vision provider */}
            <div className="sp-section">
              <div className="sp-section-label">Vision Provider</div>
              <div className="sp-section-desc">
                Used when converting handwritten notes to LaTeX.
                Your personal key overrides the server default.
              </div>
              <div className="sp-field">
                <label className="sp-label">Active provider</label>
                <select
                  className="sp-select"
                  value={visionProvider}
                  onChange={(e) => setVisionProvider(e.target.value)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* API keys */}
            <div className="sp-section">
              <div className="sp-section-label">Personal API Keys</div>
              <div className="sp-section-desc">
                Stored encrypted on the server. Leave blank to keep the current value.
                Enter a single space to clear a key.
              </div>

              <div className="sp-field">
                <label className="sp-label">
                  Anthropic API key
                  {masked?.anthropicKeySet && <span className="sp-badge-set">configured</span>}
                </label>
                <input
                  type="password"
                  className="sp-input"
                  placeholder={masked?.anthropicKeySet ? '(leave blank to keep current)' : 'sk-ant-…'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="sp-field">
                <label className="sp-label">
                  OpenAI API key
                  {masked?.openaiKeySet && <span className="sp-badge-set">configured</span>}
                </label>
                <input
                  type="password"
                  className="sp-input"
                  placeholder={masked?.openaiKeySet ? '(leave blank to keep current)' : 'sk-…'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {saveMsg && (
              <div className={`sp-msg ${saveMsg.ok ? 'ok' : 'err'}`}>{saveMsg.text}</div>
            )}

            <div className="sp-actions">
              <button type="submit" className="sp-btn-primary" disabled={saving || !masked}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .sp-root {
          min-height: 100vh;
          background: var(--bg, #1e1e2e);
          color: var(--text, #cdd6f4);
          display: flex;
          flex-direction: column;
        }
        .sp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 56px;
          border-bottom: 1px solid var(--border, #313244);
          background: var(--surface, #181825);
          flex-shrink: 0;
        }
        .sp-back {
          background: none;
          border: none;
          color: var(--text-muted, #6c7086);
          font-size: 13px;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.1s;
        }
        .sp-back:hover { color: var(--text, #cdd6f4); }
        .sp-header-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sp-logo-mark { font-size: 18px; color: var(--accent, #89b4fa); }
        .sp-title { font-size: 15px; font-weight: 600; }
        .sp-header-right { min-width: 120px; text-align: right; }
        .sp-user { font-size: 12px; color: var(--text-muted, #6c7086); }

        .sp-body {
          flex: 1;
          padding: 40px 32px;
          max-width: 560px;
          margin: 0 auto;
          width: 100%;
        }
        .sp-error {
          background: color-mix(in srgb, #f38ba8 12%, transparent);
          border: 1px solid color-mix(in srgb, #f38ba8 40%, transparent);
          border-radius: 6px;
          padding: 12px 16px;
          color: #f38ba8;
          font-size: 13px;
        }
        .sp-form { display: flex; flex-direction: column; gap: 32px; }
        .sp-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .sp-section-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted, #6c7086);
        }
        .sp-section-desc {
          font-size: 12px;
          color: var(--text-muted, #6c7086);
          line-height: 1.5;
          margin-top: -6px;
        }
        .sp-field { display: flex; flex-direction: column; gap: 6px; }
        .sp-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-sub, #a6adc8);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sp-badge-set {
          font-size: 10px;
          font-weight: 600;
          background: color-mix(in srgb, #a6e3a1 15%, transparent);
          color: #a6e3a1;
          border: 1px solid color-mix(in srgb, #a6e3a1 35%, transparent);
          border-radius: 4px;
          padding: 1px 6px;
          letter-spacing: 0.03em;
        }
        .sp-input, .sp-select {
          background: var(--surface2, #313244);
          border: 1px solid var(--border, #45475a);
          border-radius: 6px;
          color: var(--text, #cdd6f4);
          font-size: 13px;
          padding: 8px 11px;
          outline: none;
          transition: border-color 0.12s;
          width: 100%;
          box-sizing: border-box;
        }
        .sp-input:focus, .sp-select:focus { border-color: var(--accent, #89b4fa); }
        .sp-select { cursor: pointer; }

        .sp-msg {
          font-size: 13px;
          border-radius: 5px;
          padding: 8px 12px;
        }
        .sp-msg.ok {
          background: color-mix(in srgb, #a6e3a1 12%, transparent);
          border: 1px solid color-mix(in srgb, #a6e3a1 35%, transparent);
          color: #a6e3a1;
        }
        .sp-msg.err {
          background: color-mix(in srgb, #f38ba8 12%, transparent);
          border: 1px solid color-mix(in srgb, #f38ba8 35%, transparent);
          color: #f38ba8;
        }
        .sp-actions { display: flex; }
        .sp-btn-primary {
          background: var(--accent, #89b4fa);
          color: var(--bg, #1e1e2e);
          border: none;
          border-radius: 6px;
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .sp-btn-primary:hover { opacity: 0.88; }
        .sp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
