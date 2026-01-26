/**
 * E2E tests for config migration.
 *
 * These tests verify the migration flow from v1 to v2 config format
 * using actual CLI invocation.
 *
 * Note: These tests require valid Linear authentication to run the migrate command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const CLI_PATH = join(import.meta.dir, '../../src/index.ts');

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCLI(
  args: string[],
  options: { env?: Record<string, string> } = {}
): Promise<RunResult> {
  const env = {
    ...process.env,
    ...options.env,
  };

  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}

describe('config migration E2E', () => {
  let tempDir: string;
  let configDir: string;
  let originalLinearApiKey: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'linproj-e2e-migration-'));
    configDir = join(tempDir, 'linproj');

    // Save and unset LINEAR_API_KEY to test workspace-based auth
    originalLinearApiKey = process.env.LINEAR_API_KEY;
  });

  afterEach(async () => {
    // Restore LINEAR_API_KEY
    if (originalLinearApiKey !== undefined) {
      process.env.LINEAR_API_KEY = originalLinearApiKey;
    }

    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('shows migration error when running workspace command with v1 config', async () => {
    // Create v1 config
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, 'config.json'),
      JSON.stringify({ auth: { type: 'api-key', apiKey: 'test-key' } })
    );

    // Run workspace current (requires getCurrentWorkspace which enforces v2)
    const result = await runCLI(['workspace', 'current'], {
      env: {
        XDG_CONFIG_HOME: tempDir,
        // Unset LINEAR_API_KEY to use file-based config
        LINEAR_API_KEY: '',
      },
    });

    // Should show migration error
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Config migration required');
    expect(result.stderr).toContain('linproj config migrate');
  });

  it('migrates v1 config to v2 and creates workspace file', async () => {
    // Skip if no LINEAR_API_KEY available (needed for API call during migration)
    if (!originalLinearApiKey) {
      console.log('Skipping test: LINEAR_API_KEY not available');
      return;
    }

    // Create v1 config with real API key
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, 'config.json'),
      JSON.stringify({ auth: { type: 'api-key', apiKey: originalLinearApiKey } })
    );

    // Run migrate command (unset LINEAR_API_KEY so it uses file config)
    const result = await runCLI(['config', 'migrate'], {
      env: {
        XDG_CONFIG_HOME: tempDir,
        LINEAR_API_KEY: '',
      },
    });

    // Should succeed
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Fetching organization info');
    expect(result.stdout).toContain('Created workspace:');
    expect(result.stdout).toContain('Migration complete');

    // Verify v2 config was written
    const configContent = await readFile(join(configDir, 'config.json'), 'utf-8');
    const config = JSON.parse(configContent);
    expect(config.version).toBe(2);
    expect(config.currentWorkspace).toBeDefined();

    // Verify workspace file was created
    const workspacesDir = join(configDir, 'workspaces');
    const files = await readdir(workspacesDir);
    expect(files.length).toBeGreaterThan(0);

    // Verify workspace file contents
    const workspaceContent = await readFile(join(workspacesDir, files[0]!), 'utf-8');
    const workspace = JSON.parse(workspaceContent);
    expect(workspace.organizationId).toBeDefined();
    expect(workspace.organizationName).toBeDefined();
    expect(workspace.urlKey).toBeDefined();
    expect(workspace.auth).toBeDefined();
    expect(workspace.auth.apiKey).toBe(originalLinearApiKey);
  });
});
