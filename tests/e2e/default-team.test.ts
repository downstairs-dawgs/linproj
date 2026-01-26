/**
 * E2E tests for default team functionality.
 *
 * These tests verify that default team is correctly used when creating issues.
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { LinearClient, getIssue, deleteIssue, getTeams } from '../../src/lib/api.ts';

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

describe('default team E2E', () => {
  let tempDir: string;
  let configDir: string;
  let originalLinearApiKey: string | undefined;
  let createdIssueIds: string[] = [];
  let teams: { id: string; key: string; name: string }[];
  let client: LinearClient;

  beforeAll(async () => {
    // Save LINEAR_API_KEY
    originalLinearApiKey = process.env.LINEAR_API_KEY;

    if (!originalLinearApiKey) {
      console.log('Skipping default team E2E tests: LINEAR_API_KEY not available');
      return;
    }

    // Get available teams
    client = new LinearClient({ type: 'api-key', apiKey: originalLinearApiKey });
    teams = await getTeams(client);

    if (teams.length < 1) {
      console.log('Skipping default team E2E tests: No teams available');
      return;
    }
  });

  afterAll(async () => {
    // Clean up any created issues
    if (client && createdIssueIds.length > 0) {
      for (const identifier of createdIssueIds) {
        try {
          const issue = await getIssue(client, identifier);
          if (issue) {
            await deleteIssue(client, issue.id);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'linproj-e2e-default-team-'));
    configDir = join(tempDir, 'linproj');
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('creates issue in default team after setting via config set', async () => {
    if (!originalLinearApiKey || !teams || teams.length < 1) {
      return; // Skip if no auth
    }

    const testTeam = teams[0]!;

    // Create a v2 config with workspace (simulating post-migration state)
    const workspacesDir = join(configDir, 'workspaces');
    await mkdir(workspacesDir, { recursive: true });

    const workspaceId = 'test-org-id';
    const workspace = {
      organizationId: workspaceId,
      organizationName: 'Test Org',
      urlKey: 'test-org',
      auth: { type: 'api-key', apiKey: originalLinearApiKey },
    };

    await writeFile(
      join(workspacesDir, `${workspaceId}.json`),
      JSON.stringify(workspace)
    );

    await writeFile(
      join(configDir, 'config.json'),
      JSON.stringify({ version: 2, currentWorkspace: workspaceId })
    );

    // Set default team
    const setResult = await runCLI(['config', 'set', 'default-team', testTeam.key], {
      env: {
        XDG_CONFIG_HOME: tempDir,
        LINEAR_API_KEY: '', // Unset to use file config
      },
    });

    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain(`Default team set to: ${testTeam.key}`);

    // Verify workspace file was updated
    const workspaceContent = await readFile(join(workspacesDir, `${workspaceId}.json`), 'utf-8');
    const updatedWorkspace = JSON.parse(workspaceContent);
    expect(updatedWorkspace.defaultTeam).toBe(testTeam.key);

    // Create issue without specifying team
    const createResult = await runCLI(
      ['issues', 'create', '--title', `[TEST] Default team E2E ${Date.now()}`],
      {
        env: {
          XDG_CONFIG_HOME: tempDir,
          LINEAR_API_KEY: '', // Unset to use file config
        },
      }
    );

    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain('Created issue');

    // Extract issue identifier from output
    const match = createResult.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    createdIssueIds.push(issueIdentifier);

    // Verify issue was created in the default team
    expect(issueIdentifier.startsWith(testTeam.key)).toBe(true);
  });

  it('--team flag overrides default team when creating issue', async () => {
    if (!originalLinearApiKey || !teams || teams.length < 2) {
      console.log('Skipping test: Need at least 2 teams');
      return;
    }

    const defaultTeam = teams[0]!;
    const overrideTeam = teams[1]!;

    // Create a v2 config with workspace that has defaultTeam set
    const workspacesDir = join(configDir, 'workspaces');
    await mkdir(workspacesDir, { recursive: true });

    const workspaceId = 'test-org-id';
    const workspace = {
      organizationId: workspaceId,
      organizationName: 'Test Org',
      urlKey: 'test-org',
      auth: { type: 'api-key', apiKey: originalLinearApiKey },
      defaultTeam: defaultTeam.key, // Set default to first team
    };

    await writeFile(
      join(workspacesDir, `${workspaceId}.json`),
      JSON.stringify(workspace)
    );

    await writeFile(
      join(configDir, 'config.json'),
      JSON.stringify({ version: 2, currentWorkspace: workspaceId })
    );

    // Create issue with explicit --team flag (should override default)
    const createResult = await runCLI(
      [
        'issues',
        'create',
        '--title',
        `[TEST] Override team E2E ${Date.now()}`,
        '--team',
        overrideTeam.key,
      ],
      {
        env: {
          XDG_CONFIG_HOME: tempDir,
          LINEAR_API_KEY: '', // Unset to use file config
        },
      }
    );

    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain('Created issue');

    // Extract issue identifier from output
    const match = createResult.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    createdIssueIds.push(issueIdentifier);

    // Verify issue was created in the override team (not the default)
    expect(issueIdentifier.startsWith(overrideTeam.key)).toBe(true);
    expect(issueIdentifier.startsWith(defaultTeam.key)).toBe(false);
  });
});
