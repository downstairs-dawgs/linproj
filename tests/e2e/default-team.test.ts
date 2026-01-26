/**
 * E2E tests for default team functionality.
 *
 * These tests verify that default team is correctly used when creating issues.
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { E2ETestContext, runCLI } from './helpers.ts';

describe('default team E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();

    if (teams.length < 1) {
      throw new Error('At least 1 team is required for default team E2E tests');
    }
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    // Reset to fresh temp dir for each test
    await ctx.setup();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it('creates issue in default team after setting via config set', async () => {
    const testTeam = teams[0]!;

    await ctx.setupV2Config();

    // Set default team
    const setResult = await runCLI(['config', 'set', 'default-team', testTeam.key], {
      env: ctx.envWithoutApiKey(),
    });

    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain(`Default team set to: ${testTeam.key}`);

    // Verify workspace file was updated
    const workspacePath = join(ctx.configDir, 'workspaces', 'test-org-id.json');
    const workspaceContent = await readFile(workspacePath, 'utf-8');
    const updatedWorkspace = JSON.parse(workspaceContent);
    expect(updatedWorkspace.defaultTeam).toBe(testTeam.key);

    // Create issue without specifying team
    const createResult = await runCLI(
      ['issues', 'create', '--title', `[TEST] Default team E2E ${Date.now()}`],
      { env: ctx.envWithoutApiKey() }
    );

    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain('Created issue');

    // Extract issue identifier from output
    const match = createResult.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    ctx.trackCreatedIssue(issueIdentifier);

    // Verify issue was created in the default team
    expect(issueIdentifier.startsWith(testTeam.key)).toBe(true);
  });

  it('--team flag overrides default team when creating issue', async () => {
    if (teams.length < 2) {
      throw new Error('At least 2 teams are required for this test');
    }

    const defaultTeam = teams[0]!;
    const overrideTeam = teams[1]!;

    await ctx.setupV2Config({ defaultTeam: defaultTeam.key });

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
      { env: ctx.envWithoutApiKey() }
    );

    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain('Created issue');

    // Extract issue identifier from output
    const match = createResult.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    ctx.trackCreatedIssue(issueIdentifier);

    // Verify issue was created in the override team (not the default)
    expect(issueIdentifier.startsWith(overrideTeam.key)).toBe(true);
    expect(issueIdentifier.startsWith(defaultTeam.key)).toBe(false);
  });
});
