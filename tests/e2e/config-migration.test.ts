/**
 * E2E tests for config migration.
 *
 * These tests verify the migration flow from v1 to v2 config format
 * using actual CLI invocation.
 *
 * Note: Some tests require valid Linear authentication to run the migrate command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { E2ETestContext, runCLI } from './harness.ts';

describe('config migration E2E', () => {
  const ctx = new E2ETestContext();

  beforeEach(async () => {
    await ctx.setup();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it('shows migration error when running workspace command with v1 config', async () => {
    await ctx.setupV1Config('test-key');

    const result = await runCLI(['workspace', 'current'], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Config migration required');
    expect(result.stderr).toContain('linproj config migrate');
  });

  it('migrates empty v1 config to v2 without auth', async () => {
    await ctx.setupV1Config(); // No API key

    const result = await runCLI(['config', 'migrate'], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Migrated to v2 config format');
    expect(result.stdout).toContain('linproj auth login');

    // Verify v2 config was written
    const configContent = await readFile(join(ctx.configDir, 'config.json'), 'utf-8');
    const config = JSON.parse(configContent);
    expect(config.version).toBe(2);
    expect(config.currentWorkspace).toBeUndefined();
  });

  it('migrates v1 config to v2 and creates workspace file', async () => {
    ctx.requireApiKey();

    await ctx.setupV1Config(ctx.apiKey);

    const result = await runCLI(['config', 'migrate'], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Fetching organization info');
    expect(result.stdout).toContain('Created workspace:');
    expect(result.stdout).toContain('Migration complete');

    // Verify v2 config was written
    const configContent = await readFile(join(ctx.configDir, 'config.json'), 'utf-8');
    const config = JSON.parse(configContent);
    expect(config.version).toBe(2);
    expect(config.currentWorkspace).toBeDefined();

    // Verify workspace file was created
    const workspacesDir = join(ctx.configDir, 'workspaces');
    const files = await readdir(workspacesDir);
    expect(files.length).toBeGreaterThan(0);

    // Verify workspace file contents
    const workspaceContent = await readFile(join(workspacesDir, files[0]!), 'utf-8');
    const workspace = JSON.parse(workspaceContent);
    expect(workspace.organizationId).toBeDefined();
    expect(workspace.organizationName).toBeDefined();
    expect(workspace.urlKey).toBeDefined();
    expect(workspace.auth).toBeDefined();
    expect(workspace.auth.apiKey).toBe(ctx.apiKey);
  });
});
