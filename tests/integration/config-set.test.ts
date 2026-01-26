/**
 * Integration tests for `config set default-team` command.
 *
 * These tests verify that the command validates team existence via the Linear API.
 * Uses Polly.js for HTTP recording/replay.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Polly } from '@pollyjs/core';
import { setupPolly, stopPolly } from '../setup.ts';
import {
  writeGlobalConfig,
  writeWorkspace,
  readWorkspace,
  type ConfigV2,
  type WorkspaceProfile,
} from '../../src/lib/config.ts';

// Helper class for testing config operations
class TestConfigContext {
  private tempDir!: string;
  private originalXdgConfigHome: string | undefined;
  private originalLinearApiKey: string | undefined;

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-config-set-test-'));
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

describe('config set default-team', () => {
  const ctx = new TestConfigContext();
  let polly: Polly;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;

  // Test workspace setup
  const testWorkspace: WorkspaceProfile = {
    organizationId: 'test-org-id',
    organizationName: 'Test Organization',
    urlKey: 'test-org',
    auth: { type: 'api-key', apiKey: 'test-api-key' },
  };

  beforeEach(async () => {
    await ctx.setup();

    // Setup workspace
    await writeWorkspace(testWorkspace);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'test-org-id' });

    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    if (polly) {
      await stopPolly(polly);
    }
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    await ctx.teardown();
  });

  it('validates team exists and sets default-team', async () => {
    polly = setupPolly('config-set-default-team-valid');

    // Setup mock response for teams query
    polly.server.post('https://api.linear.app/graphql').intercept((req, res) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('teams')) {
        res.status(200).json({
          data: {
            teams: {
              nodes: [
                { id: 'team-1', key: 'ENG', name: 'Engineering' },
                { id: 'team-2', key: 'DES', name: 'Design' },
              ],
            },
          },
        });
      }
    });

    const { createSetCommand } = await import('../../src/commands/config/config.ts');
    const command = createSetCommand();
    await command.parseAsync(['node', 'test', 'default-team', 'ENG']);

    // Verify workspace was updated
    const workspace = await readWorkspace('test-org-id');
    expect(workspace).not.toBeNull();
    expect(workspace!.defaultTeam).toBe('ENG');

    // Verify success message
    expect(consoleLogSpy).toHaveBeenCalledWith('Default team set to: ENG');
  });

  it('fails with error when team not found', async () => {
    polly = setupPolly('config-set-default-team-invalid');

    // Setup mock response for teams query
    polly.server.post('https://api.linear.app/graphql').intercept((req, res) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('teams')) {
        res.status(200).json({
          data: {
            teams: {
              nodes: [
                { id: 'team-1', key: 'ENG', name: 'Engineering' },
                { id: 'team-2', key: 'DES', name: 'Design' },
              ],
            },
          },
        });
      }
    });

    const { createSetCommand } = await import('../../src/commands/config/config.ts');
    const command = createSetCommand();

    await expect(command.parseAsync(['node', 'test', 'default-team', 'INVALID'])).rejects.toThrow(
      'process.exit called'
    );

    // Verify error messages
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Team 'INVALID' not found.");
    expect(consoleErrorSpy).toHaveBeenCalledWith('');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Available teams:');
    expect(consoleErrorSpy).toHaveBeenCalledWith('  ENG - Engineering');
    expect(consoleErrorSpy).toHaveBeenCalledWith('  DES - Design');
    expect(processExitSpy).toHaveBeenCalledWith(1);

    // Verify workspace was NOT updated
    const workspace = await readWorkspace('test-org-id');
    expect(workspace!.defaultTeam).toBeUndefined();
  });
});
