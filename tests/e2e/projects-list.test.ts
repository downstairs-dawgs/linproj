/**
 * E2E tests for projects list command.
 *
 * Requires valid Linear authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('projects list E2E', () => {
  const ctx = new E2ETestContext();

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
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

  it('lists projects', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(['projects', 'list'], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(0);
    // Output should be project names (one per line) or "No projects found."
  });

  it('outputs JSON with --json flag', async () => {
    await ctx.setupV2Config();

    const result = await runCLI(['projects', 'list', '--json'], {
      env: ctx.envWithoutApiKey(),
    });

    expect(result.exitCode).toBe(0);

    // Verify output is valid JSON
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);

    // Each project should have id and name
    if (parsed.length > 0) {
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('name');
    }
  });
});
