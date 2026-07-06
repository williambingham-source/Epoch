import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UserSettings {
  anthropicKey?: string;
  openaiKey?: string;
  visionProvider?: string;
}

export interface UserSettingsMasked {
  anthropicKeySet: boolean;
  openaiKeySet: boolean;
  visionProvider: string;
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(token: string, key: Buffer): string {
  const parts = token.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token');
  const ivHex = parts[0]!;
  const tagHex = parts[1]!;
  const ctHex = parts[2]!;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function settingsFilePath(baseDir: string, user: string): string {
  return path.join(baseDir, user, '.epoch-settings.json');
}

type RawSettings = Record<string, string | null | undefined>;

function getEncryptionKey(): Buffer {
  const secret = process.env['NEXTAUTH_SECRET'] ?? 'dev-insecure-fallback-key-change-me';
  return deriveKey(secret);
}

export async function readUserSettings(baseDir: string, user: string): Promise<UserSettings> {
  const key = getEncryptionKey();
  try {
    const raw: RawSettings = JSON.parse(
      await fs.readFile(settingsFilePath(baseDir, user), 'utf-8'),
    );
    const settings: UserSettings = {};
    if (raw['anthropicKey']) {
      try { settings.anthropicKey = decrypt(raw['anthropicKey'], key); } catch { /* corrupt — skip */ }
    }
    if (raw['openaiKey']) {
      try { settings.openaiKey = decrypt(raw['openaiKey'], key); } catch {}
    }
    if (typeof raw['visionProvider'] === 'string') {
      settings.visionProvider = raw['visionProvider'];
    }
    return settings;
  } catch {
    return {};
  }
}

export async function writeUserSettings(
  baseDir: string,
  user: string,
  updates: { anthropicKey?: string | null; openaiKey?: string | null; visionProvider?: string },
): Promise<void> {
  const key = getEncryptionKey();

  let raw: RawSettings = {};
  try {
    raw = JSON.parse(await fs.readFile(settingsFilePath(baseDir, user), 'utf-8'));
  } catch {}

  if (updates.anthropicKey !== undefined) {
    raw['anthropicKey'] = updates.anthropicKey ? encrypt(updates.anthropicKey, key) : null;
  }
  if (updates.openaiKey !== undefined) {
    raw['openaiKey'] = updates.openaiKey ? encrypt(updates.openaiKey, key) : null;
  }
  if (updates.visionProvider !== undefined) {
    raw['visionProvider'] = updates.visionProvider;
  }

  const filePath = settingsFilePath(baseDir, user);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(raw, null, 2), 'utf-8');
}

export function maskSettings(settings: UserSettings): UserSettingsMasked {
  return {
    anthropicKeySet: !!settings.anthropicKey,
    openaiKeySet: !!settings.openaiKey,
    visionProvider: settings.visionProvider ?? process.env['VISION_PROVIDER'] ?? 'anthropic',
  };
}
