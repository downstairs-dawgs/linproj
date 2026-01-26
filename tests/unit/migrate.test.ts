/**
 * Unit tests for the `config migrate` command.
 *
 * These tests verify the migration logic from v1 to v2 config format.
 * API calls are mocked via fetch interception.
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdtemp, rm, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  readGlobalConfig,
  writeGlobalConfig,
  getConfigVersion,
  readWorkspace,
  type ConfigV1,
  type ConfigV2,
} from '../../src/lib/config.ts';

// Helper class for testing config operations (same as in config.test.ts)
class TestConfigContext {
  private tempDir!: string;
  private originalXdgConfigHome: string | undefined;

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-migrate-test-'));
    this.originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = this.tempDir;
  }

  async teardown(): Promise<void> {
    if (this.originalXdgConfigHome !== undefined) {
      process.env.XDG_CONFIG_HOME = this.originalXdgConfigHome;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }

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

// Mock organization response for API calls
const mockOrganization = {
  id: 'test-org-id-123',
  name: 'Test Organization',
  urlKey: 'test-org',
};

// Helper to mock fetch for Linear API calls
function mockFetch(response: unknown, status = 200) {
  const mockFn = mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(response),
    } as Response)
  ) as unknown as typeof fetch;
  // Add Bun's preconnect property to satisfy TypeScript
  mockFn.preconnect = () => {};
  return mockFn;
}

describe('config migrate command', () => {
  const ctx = new TestConfigContext();
  let originalFetch: typeof fetch;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    await ctx.setup();

    // Save original fetch
    originalFetch = globalThis.fetch;

    // Spy on console methods
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit to prevent test from exiting
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    // Restore fetch
    globalThis.fetch = originalFetch;

    // Restore spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();

    await ctx.teardown();
  });

  it('shows message and returns when config is already v2', async () => {
    // Setup: Write a v2 config
    const v2Config: ConfigV2 = {
      version: 2,
      currentWorkspace: 'existing-org',
    };
    await writeGlobalConfig(v2Config);

    // Import and run the migrate command action
    const { createMigrateCommand } = await import('../../src/commands/config/migrate.ts');
    const command = createMigrateCommand();
    await command.parseAsync(['node', 'test']);

    // Verify it logged the appropriate message
    expect(consoleLogSpy).toHaveBeenCalledWith('Config is already v2 format. No migration needed.');
  });

  it('migrates v1 config without auth to empty v2 config', async () => {
    // Setup: Write an empty v1 config (no auth)
    await writeGlobalConfig({});

    const { createMigrateCommand } = await import('../../src/commands/config/migrate.ts');
    const command = createMigrateCommand();
    await command.parseAsync(['node', 'test']);

    // Verify it created v2 config without workspace
    const globalConfig = await readGlobalConfig();
    expect(getConfigVersion(globalConfig)).toBe(2);
    expect((globalConfig as ConfigV2).currentWorkspace).toBeUndefined();

    expect(consoleLogSpy).toHaveBeenCalledWith('Migrated to v2 config format.');
    expect(consoleLogSpy).toHaveBeenCalledWith('Run `linproj auth login` to authenticate.');
  });

  it('migrates v1 api-key auth to workspace', async () => {
    // Setup: Write v1 config with api-key auth
    const v1Config: ConfigV1 = {
      auth: { type: 'api-key', apiKey: 'test-api-key' },
    };
    await writeGlobalConfig(v1Config);

    // Mock fetch to return organization data
    globalThis.fetch = mockFetch({
      data: { organization: mockOrganization },
    });

    const { createMigrateCommand } = await import('../../src/commands/config/migrate.ts');
    const command = createMigrateCommand();
    await command.parseAsync(['node', 'test']);

    // Verify global config is now v2
    const globalConfig = await readGlobalConfig();
    expect(getConfigVersion(globalConfig)).toBe(2);
    expect((globalConfig as ConfigV2).currentWorkspace).toBe(mockOrganization.id);

    // Verify workspace was created
    const workspace = await readWorkspace(mockOrganization.id);
    expect(workspace).not.toBeNull();
    expect(workspace!.organizationId).toBe(mockOrganization.id);
    expect(workspace!.organizationName).toBe(mockOrganization.name);
    expect(workspace!.urlKey).toBe(mockOrganization.urlKey);
    expect(workspace!.auth).toEqual({ type: 'api-key', apiKey: 'test-api-key' });

    // Verify success messages
    expect(consoleLogSpy).toHaveBeenCalledWith('Fetching organization info...');
    expect(consoleLogSpy).toHaveBeenCalledWith(`Created workspace: ${mockOrganization.name}`);
    expect(consoleLogSpy).toHaveBeenCalledWith('Migration complete.');
  });

  it('migrates v1 oauth auth to workspace', async () => {
    // Setup: Write v1 config with OAuth auth
    const v1Config: ConfigV1 = {
      auth: {
        type: 'oauth',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: '2025-12-31T00:00:00Z',
      },
    };
    await writeGlobalConfig(v1Config);

    // Mock fetch to return organization data
    globalThis.fetch = mockFetch({
      data: { organization: mockOrganization },
    });

    const { createMigrateCommand } = await import('../../src/commands/config/migrate.ts');
    const command = createMigrateCommand();
    await command.parseAsync(['node', 'test']);

    // Verify workspace was created with OAuth auth
    const workspace = await readWorkspace(mockOrganization.id);
    expect(workspace).not.toBeNull();
    expect(workspace!.auth).toEqual({
      type: 'oauth',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: '2025-12-31T00:00:00Z',
    });

    // Verify global config is v2
    const globalConfig = await readGlobalConfig();
    expect(getConfigVersion(globalConfig)).toBe(2);
  });

  it('handles API 401 error gracefully', async () => {
    // Setup: Write v1 config with api-key auth
    const v1Config: ConfigV1 = {
      auth: { type: 'api-key', apiKey: 'invalid-api-key' },
    };
    await writeGlobalConfig(v1Config);

    // Mock fetch to return 401 error
    globalThis.fetch = mockFetch({}, 401);

    const { createMigrateCommand } = await import('../../src/commands/config/migrate.ts');
    const command = createMigrateCommand();

    await expect(command.parseAsync(['node', 'test'])).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Invalid or expired auth credentials.');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Run `linproj auth login` to re-authenticate.');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('handles API errors gracefully', async () => {
    // Setup: Write v1 config with api-key auth
    const v1Config: ConfigV1 = {
      auth: { type: 'api-key', apiKey: 'test-api-key' },
    };
    await writeGlobalConfig(v1Config);

    // Mock fetch to return GraphQL errors
    globalThis.fetch = mockFetch({
      errors: [{ message: 'Something went wrong' }],
    });

    const { createMigrateCommand } = await import('../../src/commands/config/migrate.ts');
    const command = createMigrateCommand();

    await expect(command.parseAsync(['node', 'test'])).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Something went wrong');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
