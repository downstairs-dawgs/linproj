/**
 * Unit tests for auth commands (logout, status).
 *
 * These tests verify the file operations and output for auth commands.
 * API calls are mocked via fetch interception.
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  readGlobalConfig,
  writeGlobalConfig,
  writeWorkspace,
  readWorkspace,
  listWorkspaces,
  getConfigVersion,
  type ConfigV1,
  type ConfigV2,
  type WorkspaceProfile,
} from '../../src/lib/config.ts';

// Helper class for testing config operations
class TestConfigContext {
  private tempDir!: string;
  private originalXdgConfigHome: string | undefined;
  private originalLinearApiKey: string | undefined;

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-auth-test-'));
    this.originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    this.originalLinearApiKey = process.env.LINEAR_API_KEY;

    process.env.XDG_CONFIG_HOME = this.tempDir;
    // Unset LINEAR_API_KEY so requireWorkspaceAuth() doesn't throw
    delete process.env.LINEAR_API_KEY;
  }

  async teardown(): Promise<void> {
    if (this.originalXdgConfigHome !== undefined) {
      process.env.XDG_CONFIG_HOME = this.originalXdgConfigHome;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }

    if (this.originalLinearApiKey !== undefined) {
      process.env.LINEAR_API_KEY = this.originalLinearApiKey;
    } else {
      delete process.env.LINEAR_API_KEY;
    }

    try {
      await rm(this.tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Mock user response for API calls
const mockViewer = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
};

// Helper to mock fetch for Linear API calls
function mockFetch(response: unknown, status = 200) {
  return mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(response),
    } as Response)
  );
}

describe('auth logout command', () => {
  const ctx = new TestConfigContext();
  let originalFetch: typeof fetch;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    await ctx.setup();
    originalFetch = globalThis.fetch;
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    await ctx.teardown();
  });

  it('removes current workspace file', async () => {
    // Setup: Create v2 config with one workspace
    const workspace: WorkspaceProfile = {
      organizationId: 'org-123',
      organizationName: 'Test Org',
      urlKey: 'test-org',
      auth: { type: 'api-key', apiKey: 'test-key' },
    };
    await writeWorkspace(workspace);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-123' });

    const { createLogoutCommand } = await import('../../src/commands/auth/logout.ts');
    const command = createLogoutCommand();
    await command.parseAsync(['node', 'test']);

    // Verify workspace was deleted
    const ws = await readWorkspace('org-123');
    expect(ws).toBeNull();

    // Verify message
    expect(consoleLogSpy).toHaveBeenCalledWith('Logged out from: Test Org');
  });

  it('removes specific workspace with --workspace flag', async () => {
    // Setup: Create v2 config with two workspaces
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
    };
    await writeWorkspace(workspace1);
    await writeWorkspace(workspace2);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-1' });

    const { createLogoutCommand } = await import('../../src/commands/auth/logout.ts');
    const command = createLogoutCommand();
    await command.parseAsync(['node', 'test', '--workspace', 'Org Two']);

    // Verify only the specified workspace was deleted
    const ws1 = await readWorkspace('org-1');
    const ws2 = await readWorkspace('org-2');
    expect(ws1).not.toBeNull();
    expect(ws2).toBeNull();

    // Verify message
    expect(consoleLogSpy).toHaveBeenCalledWith('Logged out from: Org Two');
  });

  it('removes all workspaces with --all flag', async () => {
    // Setup: Create v2 config with multiple workspaces
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
    };
    await writeWorkspace(workspace1);
    await writeWorkspace(workspace2);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-1' });

    const { createLogoutCommand } = await import('../../src/commands/auth/logout.ts');
    const command = createLogoutCommand();
    await command.parseAsync(['node', 'test', '--all']);

    // Verify all workspaces were deleted
    const workspaces = await listWorkspaces();
    expect(workspaces).toHaveLength(0);

    // Verify message
    expect(consoleLogSpy).toHaveBeenCalledWith('Logged out from all 2 workspace(s)');
  });

  it('switches to another workspace when current is removed', async () => {
    // Setup: Create v2 config with two workspaces
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
    };
    await writeWorkspace(workspace1);
    await writeWorkspace(workspace2);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-1' });

    const { createLogoutCommand } = await import('../../src/commands/auth/logout.ts');
    const command = createLogoutCommand();
    await command.parseAsync(['node', 'test']);

    // Verify current workspace switched to remaining one
    const config = await readGlobalConfig() as ConfigV2;
    expect(config.currentWorkspace).toBe('org-2');

    // Verify messages
    expect(consoleLogSpy).toHaveBeenCalledWith('Logged out from: Org One');
    expect(consoleLogSpy).toHaveBeenCalledWith('Switched to: Org Two');
  });
});

describe('auth status command', () => {
  const ctx = new TestConfigContext();
  let originalFetch: typeof fetch;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    await ctx.setup();
    originalFetch = globalThis.fetch;
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await ctx.teardown();
  });

  it('shows workspace name for v2 config', async () => {
    // Setup: Create v2 config with workspace
    const workspace: WorkspaceProfile = {
      organizationId: 'org-123',
      organizationName: 'Test Organization',
      urlKey: 'test-org',
      auth: { type: 'api-key', apiKey: 'test-key' },
    };
    await writeWorkspace(workspace);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-123' });

    // Mock API to return viewer
    globalThis.fetch = mockFetch({
      data: { viewer: mockViewer },
    });

    const { createStatusCommand } = await import('../../src/commands/auth/status.ts');
    const command = createStatusCommand();
    await command.parseAsync(['node', 'test']);

    // Verify output includes workspace name
    expect(consoleLogSpy).toHaveBeenCalledWith(`Logged in as ${mockViewer.name} (${mockViewer.email}) via API key`);
    expect(consoleLogSpy).toHaveBeenCalledWith('Workspace: Test Organization');
  });

  it('shows default team when set', async () => {
    // Setup: Create v2 config with workspace that has default team
    const workspace: WorkspaceProfile = {
      organizationId: 'org-123',
      organizationName: 'Test Organization',
      urlKey: 'test-org',
      auth: { type: 'api-key', apiKey: 'test-key' },
      defaultTeam: 'ENG',
    };
    await writeWorkspace(workspace);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-123' });

    // Mock API to return viewer
    globalThis.fetch = mockFetch({
      data: { viewer: mockViewer },
    });

    const { createStatusCommand } = await import('../../src/commands/auth/status.ts');
    const command = createStatusCommand();
    await command.parseAsync(['node', 'test']);

    // Verify output includes default team
    expect(consoleLogSpy).toHaveBeenCalledWith('Default team: ENG');
  });

  it('shows migration notice for v1 config', async () => {
    // Setup: Create v1 config with auth
    const v1Config: ConfigV1 = {
      auth: { type: 'api-key', apiKey: 'test-key' },
    };
    await writeGlobalConfig(v1Config);

    // Mock API to return viewer
    globalThis.fetch = mockFetch({
      data: { viewer: mockViewer },
    });

    const { createStatusCommand } = await import('../../src/commands/auth/status.ts');
    const command = createStatusCommand();
    await command.parseAsync(['node', 'test']);

    // Verify migration notice is shown
    expect(consoleLogSpy).toHaveBeenCalledWith('Note: Your config uses an older format.');
    expect(consoleLogSpy).toHaveBeenCalledWith('Run `linproj config migrate` to enable workspace features.');
  });

  it('shows not authenticated message when no auth', async () => {
    // Setup: Create empty config
    await writeGlobalConfig({});

    const { createStatusCommand } = await import('../../src/commands/auth/status.ts');
    const command = createStatusCommand();
    await command.parseAsync(['node', 'test']);

    // Verify not authenticated message
    expect(consoleLogSpy).toHaveBeenCalledWith('Not authenticated');
    expect(consoleLogSpy).toHaveBeenCalledWith('Run `linproj auth login` to authenticate');
  });
});
