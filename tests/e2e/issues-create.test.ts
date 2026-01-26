/**
 * E2E tests for issues create command.
 *
 * Tests that default team and workspace selection work correctly.
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues create E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();

    if (teams.length < 2) {
      throw new Error('At least 2 teams required for issues create E2E tests');
    }
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    await ctx.setup();
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it('uses default team from workspace', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const result = await runCLI(
      ['issues', 'create', '--title', `[TEST] Default team create ${Date.now()}`],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created issue');

    // Extract issue identifier and track for cleanup
    const match = result.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    ctx.trackCreatedIssue(issueIdentifier);

    // Verify issue was created in the default team
    expect(issueIdentifier.startsWith(testTeam.key)).toBe(true);
  });

  it('--workspace flag uses credentials from specified workspace', async () => {
    const defaultTeam = teams[0]!;
    const workspace2Team = teams[1]!;

    // Setup primary workspace
    await ctx.setupV2Config({ defaultTeam: defaultTeam.key });

    // Create second workspace with different default team
    const workspace2Id = 'workspace-2';
    const workspacesDir = join(ctx.configDir, 'workspaces');
    await mkdir(workspacesDir, { recursive: true });

    await writeFile(
      join(workspacesDir, `${workspace2Id}.json`),
      JSON.stringify({
        organizationId: workspace2Id,
        organizationName: 'Second Workspace',
        urlKey: 'workspace-2',
        auth: { type: 'api-key', apiKey: ctx.apiKey },
        defaultTeam: workspace2Team.key,
      })
    );

    const result = await runCLI(
      [
        'issues',
        'create',
        '--title',
        `[TEST] Workspace flag create ${Date.now()}`,
        '--workspace',
        'Second Workspace',
      ],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created issue');

    // Extract issue identifier and track for cleanup
    const match = result.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    ctx.trackCreatedIssue(issueIdentifier);

    // Verify issue was created in workspace2's default team
    expect(issueIdentifier.startsWith(workspace2Team.key)).toBe(true);
  });

  it('fails when no team specified, no default, and no TTY', async () => {
    // Setup workspace without default team
    await ctx.setupV2Config();

    const result = await runCLI(
      ['issues', 'create', '--title', '[TEST] Should fail'],
      { env: ctx.envWithoutApiKey() }
    );

    // Without a TTY, can't prompt for team selection
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Interactive selection requires a TTY');
  });
});
