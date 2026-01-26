import { homedir } from 'os';
import { join } from 'path';

// Functions to compute paths dynamically (supports environment variable changes in tests)
export function getConfigDir(): string {
  // XDG Base Directory Specification
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, 'linproj');
  }

  // Windows
  const appData = process.env.APPDATA;
  if (appData && process.platform === 'win32') {
    return join(appData, 'linproj');
  }

  // Default: ~/.config/linproj
  return join(homedir(), '.config', 'linproj');
}

export function getConfigFile(): string {
  return join(getConfigDir(), 'config.json');
}

export function getWorkspacesDir(): string {
  return join(getConfigDir(), 'workspaces');
}

// Legacy exports for backward compatibility (static values from initial load)
export const CONFIG_DIR = getConfigDir();
export const CONFIG_FILE = getConfigFile();
export const WORKSPACES_DIR = getWorkspacesDir();
