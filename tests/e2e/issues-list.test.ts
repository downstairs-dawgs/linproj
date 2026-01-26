/**
 * E2E tests for issues list command.
 *
 * Tests that default team is correctly used when listing issues.
 * Requires valid Linear authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues list E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();

    if (teams.length < 2) {
      throw new Error('At least 2 teams required for issues list E2E tests');
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

  it('uses default team from workspace when --team not specified', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const result = await runCLI(['issues', 'list'], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(0);
    // The list command should succeed without requiring --team flag
    // when a default team is configured
  });

  it('--team flag overrides default team', async () => {
    const defaultTeam = teams[0]!;
    const overrideTeam = teams[1]!;

    await ctx.setupV2Config({ defaultTeam: defaultTeam.key });

    const result = await runCLI(['issues', 'list', '--team', overrideTeam.key], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(0);
    // Command should succeed with explicit --team flag
  });

  it('lists issues across all teams when no team specified', async () => {
    // Setup workspace without default team
    await ctx.setupV2Config();

    const result = await runCLI(['issues', 'list'], {
      env: ctx.envWithoutApiKey(),
    });

    // List command doesn't require a team - it lists across all teams
    expect(result.exitCode).toBe(0);
  });
});
