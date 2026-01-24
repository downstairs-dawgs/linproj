import { mkdir, readFile, writeFile, chmod } from 'fs/promises';
import { dirname } from 'path';
import { CONFIG_DIR, CONFIG_FILE } from './paths.ts';

// Discriminated union for auth - each variant has exactly the fields it needs
export type ApiKeyAuth = {
  type: 'api-key';
  apiKey: string;
};

export type OAuthAuth = {
  type: 'oauth';
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type Auth = ApiKeyAuth | OAuthAuth;

export interface Config {
  auth?: Auth;
}

export async function readConfig(): Promise<Config> {
  // Check for LINEAR_API_KEY environment variable first
  const envApiKey = process.env.LINEAR_API_KEY;
  if (envApiKey) {
    return {
      auth: {
        type: 'api-key',
        apiKey: envApiKey,
      },
    };
  }

  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  // Set permissions to owner read/write only (0600)
  await chmod(CONFIG_FILE, 0o600);
}

export async function clearAuth(): Promise<void> {
  const config = await readConfig();
  delete config.auth;
  await writeConfig(config);
}

export function getAuthToken(auth: Auth): string {
  switch (auth.type) {
    case 'api-key':
      return auth.apiKey;
    case 'oauth':
      return auth.accessToken;
  }
}

export function getAuthHeader(auth: Auth): string {
  switch (auth.type) {
    case 'api-key':
      // API keys use plain header (no Bearer prefix)
      return auth.apiKey;
    case 'oauth':
      return `Bearer ${auth.accessToken}`;
  }
}
