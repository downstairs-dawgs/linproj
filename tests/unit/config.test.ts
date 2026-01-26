import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getConfigVersion,
  readGlobalConfig,
  readWorkspace,
  writeWorkspace,
  listWorkspaces,
  getCurrentWorkspace,
  setCurrentWorkspace,
  writeGlobalConfig,
  isUsingEnvAuth,
  type ConfigV1,
  type ConfigV2,
  type WorkspaceProfile,
} from '../../src/lib/config.ts';

// Helper class for testing config operations
// Uses a unique env var prefix to avoid conflicts with other tests running in parallel
class TestConfigContext {
  private tempDir!: string;
  private originalXdgConfigHome: string | undefined;
  // We intentionally do NOT touch LINEAR_API_KEY to avoid affecting other tests
  // The config functions will read from XDG_CONFIG_HOME-based paths instead

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-test-'));

    // Save original XDG_CONFIG_HOME
    this.originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

    // Point config to temp directory
    // This is safe because we're only changing where config files are read/written,
    // not affecting any API authentication
    process.env.XDG_CONFIG_HOME = this.tempDir;
  }

  async teardown(): Promise<void> {
    // Restore XDG_CONFIG_HOME immediately to minimize window for race conditions
    if (this.originalXdgConfigHome !== undefined) {
      process.env.XDG_CONFIG_HOME = this.originalXdgConfigHome;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }

    // Clean up temp directory
    try {
      await rm(this.tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  get configDir(): string {
    return join(this.tempDir, 'linproj');
  }

  get workspacesDir(): string {
    return join(this.configDir, 'workspaces');
  }
}

describe('getConfigVersion', () => {
  it('returns 1 for empty object', () => {
    expect(getConfigVersion({})).toBe(1);
  });

  it('returns 1 for null', () => {
    expect(getConfigVersion(null)).toBe(1);
  });

  it('returns 1 for v1 config with auth', () => {
    const config: ConfigV1 = {
      auth: { type: 'api-key', apiKey: 'test-key' },
    };
    expect(getConfigVersion(config)).toBe(1);
  });

  it('returns 2 for config with version: 2', () => {
    const config: ConfigV2 = {
      version: 2,
      currentWorkspace: 'test-org',
    };
    expect(getConfigVersion(config)).toBe(2);
  });

  it('returns 1 for config with wrong version number', () => {
    expect(getConfigVersion({ version: 1 })).toBe(1);
    expect(getConfigVersion({ version: 3 })).toBe(1);
  });
});

describe('isUsingEnvAuth', () => {
  // Helper to safely test with a modified env var and restore immediately
  function withEnvVar(key: string, value: string | undefined, fn: () => void): void {
    const original = process.env[key];
    try {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
      fn();
    } finally {
      // Restore immediately to minimize race condition window
      if (original !== undefined) {
        process.env[key] = original;
      } else {
        delete process.env[key];
      }
    }
  }

  it('returns true when LINEAR_API_KEY is set', () => {
    withEnvVar('LINEAR_API_KEY', 'test-key', () => {
      expect(isUsingEnvAuth()).toBe(true);
    });
  });

  it('returns false when LINEAR_API_KEY is not set', () => {
    withEnvVar('LINEAR_API_KEY', undefined, () => {
      expect(isUsingEnvAuth()).toBe(false);
    });
  });
});

describe('workspace operations', () => {
  const ctx = new TestConfigContext();

  beforeEach(async () => {
    await ctx.setup();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it('readGlobalConfig returns empty object when file missing', async () => {
    const config = await readGlobalConfig();
    expect(config).toEqual({});
  });

  it('readWorkspace returns null when workspace file missing', async () => {
    const workspace = await readWorkspace('nonexistent-org');
    expect(workspace).toBeNull();
  });

  it('writeWorkspace creates workspaces directory and workspace file', async () => {
    const workspace: WorkspaceProfile = {
      organizationId: 'test-org-123',
      organizationName: 'Test Org',
      urlKey: 'test-org',
      auth: { type: 'api-key', apiKey: 'test-key' },
    };

    await writeWorkspace(workspace);

    const read = await readWorkspace('test-org-123');
    expect(read).toEqual(workspace);
  });

  it('listWorkspaces returns empty array when no workspaces', async () => {
    const workspaces = await listWorkspaces();
    expect(workspaces).toEqual([]);
  });

  it('listWorkspaces returns all workspace profiles', async () => {
    const workspace1: WorkspaceProfile = {
      organizationId: 'org-1',
      organizationName: 'Org One',
      urlKey: 'org-one',
      auth: { type: 'api-key', apiKey: 'key-1' },
    };

    const workspace2: WorkspaceProfile = {
      organizationId: 'org-2',
      organizationName: 'Org Two',
      urlKey: 'org-two',
      auth: { type: 'api-key', apiKey: 'key-2' },
      defaultTeam: 'ENG',
    };

    await writeWorkspace(workspace1);
    await writeWorkspace(workspace2);

    const workspaces = await listWorkspaces();
    expect(workspaces).toHaveLength(2);
    expect(workspaces).toContainEqual(workspace1);
    expect(workspaces).toContainEqual(workspace2);
  });

  it('getCurrentWorkspace throws error for v1 config', async () => {
    const v1Config: ConfigV1 = {
      auth: { type: 'api-key', apiKey: 'test-key' },
    };
    await writeGlobalConfig(v1Config);

    await expect(getCurrentWorkspace()).rejects.toThrow('Config migration required');
  });

  it('getCurrentWorkspace throws error when no current workspace set', async () => {
    const v2Config: ConfigV2 = { version: 2 };
    await writeGlobalConfig(v2Config);

    await expect(getCurrentWorkspace()).rejects.toThrow('No workspace configured');
  });

  it('getCurrentWorkspace throws error when workspace file not found', async () => {
    const v2Config: ConfigV2 = {
      version: 2,
      currentWorkspace: 'nonexistent-org',
    };
    await writeGlobalConfig(v2Config);

    await expect(getCurrentWorkspace()).rejects.toThrow("Workspace 'nonexistent-org' not found");
  });

  it('getCurrentWorkspace returns current workspace profile', async () => {
    const workspace: WorkspaceProfile = {
      organizationId: 'current-org',
      organizationName: 'Current Org',
      urlKey: 'current-org',
      auth: { type: 'api-key', apiKey: 'test-key' },
      defaultTeam: 'DEV',
    };

    await writeWorkspace(workspace);

    const v2Config: ConfigV2 = {
      version: 2,
      currentWorkspace: 'current-org',
    };
    await writeGlobalConfig(v2Config);

    const current = await getCurrentWorkspace();
    expect(current).toEqual(workspace);
  });

  it('setCurrentWorkspace updates global config', async () => {
    const workspace: WorkspaceProfile = {
      organizationId: 'target-org',
      organizationName: 'Target Org',
      urlKey: 'target-org',
      auth: { type: 'api-key', apiKey: 'test-key' },
    };

    await writeWorkspace(workspace);
    await setCurrentWorkspace('target-org');

    const config = await readGlobalConfig() as ConfigV2;
    expect(config.version).toBe(2);
    expect(config.currentWorkspace).toBe('target-org');
  });

  it('setCurrentWorkspace throws error for nonexistent workspace', async () => {
    await expect(setCurrentWorkspace('nonexistent-org')).rejects.toThrow(
      "Workspace 'nonexistent-org' not found"
    );
  });
});
