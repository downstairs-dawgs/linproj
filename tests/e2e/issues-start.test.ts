/**
 * E2E tests for issues start command.
 *
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';
import { createIssue, getIssue, LinearClient } from '../../src/lib/api.ts';

describe('issues start E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];
  let client: LinearClient;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();
    client = await ctx.getLinearClient();

    if (teams.length < 1) {
      throw new Error('At least 1 team required for issues start E2E tests');
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

  it('starts an issue', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    // Create a test issue
    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Start command ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    const result = await runCLI(
      ['issues', 'start', issue.identifier],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✓');
    expect(result.stdout).toContain(issue.identifier);

    // Verify the issue state changed
    const updated = await getIssue(client, issue.identifier);
    expect(updated?.state.type).toBe('started');
  });

  it('outputs JSON when --json flag is used', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Start JSON ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    const result = await runCLI(
      ['issues', 'start', issue.identifier, '--json'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.issue.identifier).toBe(issue.identifier);
    expect(json.changes.state).toBeDefined();
  });

  it('handles already-started issues gracefully', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Already started ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    // Start it first
    await runCLI(
      ['issues', 'start', issue.identifier],
      { env: ctx.envWithoutApiKey() }
    );

    // Try to start it again
    const result = await runCLI(
      ['issues', 'start', issue.identifier],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('already in progress');
  });

  it('fails for non-existent issue', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const result = await runCLI(
      ['issues', 'start', 'NONEXISTENT-99999'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });
});
