import { homedir } from 'os';
import { join } from 'path';

function getConfigDir(): string {
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

export const CONFIG_DIR = getConfigDir();
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
