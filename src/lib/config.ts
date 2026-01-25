import { mkdir, readFile, writeFile, chmod, readdir } from 'fs/promises';
import { join } from 'path';
import { getConfigDir, getConfigFile, getWorkspacesDir } from './paths.ts';

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

// V1 config (legacy) - identified by absence of version field
export interface ConfigV1 {
  auth?: Auth;
}

// V2 global config
export interface ConfigV2 {
  version: 2;
  currentWorkspace?: string; // References workspace file by org ID (filename without .json)
}

// Workspace profile stored in workspaces/<organizationId>.json
export interface WorkspaceProfile {
  organizationId: string;    // Linear org ID (stable, never changes)
  organizationName: string;  // Linear org display name (for UI)
  urlKey: string;            // Linear org urlKey (for display/reference)
  auth: Auth;
  defaultTeam?: string;      // Team key (e.g., "ENG")
}

// Union type for config - used internally
export type Config = ConfigV1 | ConfigV2;

export async function readConfig(): Promise<Config> {
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
    const content = await readFile(getConfigFile(), 'utf-8');
    return JSON.parse(content) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getConfigFile(), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  // Set permissions to owner read/write only (0600)
  await chmod(getConfigFile(), 0o600);
}

export async function clearAuth(): Promise<void> {
  const config = await readConfig();
  // Only works with v1 config
  if (getConfigVersion(config) === 1) {
    delete (config as ConfigV1).auth;
    await writeConfig(config);
  }
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

export function getConfigVersion(config: unknown): 1 | 2 {
  if (typeof config === 'object' && config !== null) {
    if ('version' in config && config.version === 2) {
      return 2;
    }
  }
  return 1; // Legacy or empty config
}

export function isUsingEnvAuth(): boolean {
  return !!process.env.LINEAR_API_KEY;
}

export async function readGlobalConfig(): Promise<ConfigV1 | ConfigV2> {
  try {
    const content = await readFile(getConfigFile(), 'utf-8');
    return JSON.parse(content) as ConfigV1 | ConfigV2;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeGlobalConfig(config: ConfigV1 | ConfigV2): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getConfigFile(), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  await chmod(getConfigFile(), 0o600);
}

export async function readWorkspace(organizationId: string): Promise<WorkspaceProfile | null> {
  const workspacePath = join(getWorkspacesDir(), `${organizationId}.json`);
  try {
    const content = await readFile(workspacePath, 'utf-8');
    return JSON.parse(content) as WorkspaceProfile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function writeWorkspace(workspace: WorkspaceProfile): Promise<void> {
  await mkdir(getWorkspacesDir(), { recursive: true });
  const workspacePath = join(getWorkspacesDir(), `${workspace.organizationId}.json`);
  await writeFile(workspacePath, JSON.stringify(workspace, null, 2) + '\n', 'utf-8');
  await chmod(workspacePath, 0o600);
}

export async function deleteWorkspace(organizationId: string): Promise<void> {
  const workspacePath = join(getWorkspacesDir(), `${organizationId}.json`);
  const { unlink } = await import('fs/promises');
  try {
    await unlink(workspacePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

export async function listWorkspaces(): Promise<WorkspaceProfile[]> {
  try {
    const files = await readdir(getWorkspacesDir());
    const workspaces: WorkspaceProfile[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const organizationId = file.slice(0, -5); // Remove .json
        const workspace = await readWorkspace(organizationId);
        if (workspace) {
          workspaces.push(workspace);
        }
      }
    }

    return workspaces;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function getCurrentWorkspace(): Promise<WorkspaceProfile> {
  const globalConfig = await readGlobalConfig();
  const version = getConfigVersion(globalConfig);

  if (version === 1) {
    throw new Error(
      'Config migration required.\n\n' +
      'Your configuration uses an older format. Run:\n' +
      '  linproj config migrate\n\n' +
      'This will:\n' +
      '  - Fetch your organization info from Linear\n' +
      '  - Create a workspace profile for your current auth'
    );
  }

  const config = globalConfig as ConfigV2;
  if (!config.currentWorkspace) {
    throw new Error(
      'No workspace configured.\n\n' +
      'Run `linproj auth login` to set up a workspace.'
    );
  }

  const workspace = await readWorkspace(config.currentWorkspace);
  if (!workspace) {
    throw new Error(
      `Workspace '${config.currentWorkspace}' not found.\n\n` +
      'Run `linproj auth login` to set up a workspace.'
    );
  }

  return workspace;
}

export async function getAuth(): Promise<Auth> {
  const envApiKey = process.env.LINEAR_API_KEY;
  if (envApiKey) {
    return {
      type: 'api-key',
      apiKey: envApiKey,
    };
  }

  const globalConfig = await readGlobalConfig();
  const version = getConfigVersion(globalConfig);

  if (version === 1) {
    const config = globalConfig as ConfigV1;
    if (!config.auth) {
      throw new Error(
        'Not authenticated.\n\n' +
        'Run `linproj auth login` first.'
      );
    }
    return config.auth;
  }

  const workspace = await getCurrentWorkspace();
  return workspace.auth;
}

export async function setCurrentWorkspace(organizationId: string): Promise<void> {
  const workspace = await readWorkspace(organizationId);
  if (!workspace) {
    throw new Error(`Workspace '${organizationId}' not found.`);
  }

  const config: ConfigV2 = {
    version: 2,
    currentWorkspace: organizationId,
  };
  await writeGlobalConfig(config);
}

export async function findWorkspaceByName(name: string): Promise<WorkspaceProfile | null> {
  const workspaces = await listWorkspaces();
  return workspaces.find(
    (w) => w.organizationName.toLowerCase() === name.toLowerCase()
  ) ?? null;
}

export function requireWorkspaceAuth(): void {
  if (isUsingEnvAuth()) {
    throw new Error(
      'Not available when LINEAR_API_KEY environment variable is set.\n\n' +
      'Unset the variable and run `linproj auth login` to use workspaces.'
    );
  }
}

export interface AuthContext {
  auth: Auth;
  defaultTeam?: string;
}

export async function getAuthContext(workspaceName?: string): Promise<AuthContext> {
  if (workspaceName && !isUsingEnvAuth()) {
    const workspace = await findWorkspaceByName(workspaceName);
    if (!workspace) {
      throw new Error(`Workspace '${workspaceName}' not found.`);
    }
    return { auth: workspace.auth, defaultTeam: workspace.defaultTeam };
  }

  const auth = await getAuth();

  if (isUsingEnvAuth()) {
    return { auth };
  }

  const globalConfig = await readGlobalConfig();
  if (getConfigVersion(globalConfig) === 2) {
    const workspace = await getCurrentWorkspace();
    return { auth, defaultTeam: workspace.defaultTeam };
  }

  return { auth };
}
