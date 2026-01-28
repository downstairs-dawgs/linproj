/**
 * E2E tests for projects update command.
 *
 * Requires valid Linear authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';
import { getProjects } from '../../src/lib/api.ts';

describe('projects update E2E', () => {
  const ctx = new E2ETestContext();
  let testProjectId: string;
  let testProjectName: string;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    // Get a project to use for tests
    const client = await ctx.getLinearClient();
    const projects = await getProjects(client);

    if (projects.length === 0) {
      throw new Error('At least 1 project required for projects update E2E tests');
    }

    testProjectId = projects[0]!.id;
    testProjectName = projects[0]!.name;
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

  it('creates update with --body and --health flags', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectName, '--body', '[E2E TEST] Status update', '--health', 'on-track'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project update created:');
    expect(result.stdout).toContain('linear.app');
  });

  it('creates off-track update with --body and --health flags', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectName, '--body', '[E2E TEST] everything is going badly!!', '--health', 'off-track'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project update created:');
    expect(result.stdout).toContain('linear.app');
  });

  it('creates update using project ID', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectId, '--body', '[E2E TEST] Update via ID'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project update created:');
  });

  it('outputs JSON with --json flag', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectName, '--body', '[E2E TEST] JSON output test', '--json'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);

    // Verify output is valid JSON
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('body', '[E2E TEST] JSON output test');
    expect(parsed).toHaveProperty('url');
    expect(parsed).toHaveProperty('project');
    expect(parsed).toHaveProperty('user');
  });

  it('suppresses output with --quiet flag', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectName, '--body', '[E2E TEST] Quiet test', '--quiet'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('fails with invalid health status', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectName, '--body', 'Test', '--health', 'invalid-status'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid health status 'invalid-status'");
    expect(result.stderr).toContain('Valid values: on-track, at-risk, off-track');
  });

  it('fails when body is missing', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', testProjectName],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Update body is required');
  });

  it('fails when project not found', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(
      ['projects', 'update', 'NonexistentProjectXYZ123', '--body', 'Test'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Project 'NonexistentProjectXYZ123' not found");
  });
});
