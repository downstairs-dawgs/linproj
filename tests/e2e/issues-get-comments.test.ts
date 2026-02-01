/**
 * E2E tests for issues get command with comments integration.
 *
 * Tests that the `issues get` command shows comments by default and supports --no-comments.
 * Requires valid Linear authentication (LINEAR_API_KEY env var).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues get with comments E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for E2E tests');
    }

    // Create a test issue with multiple comments for truncation testing
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Issues Get Comments E2E ${Date.now()}`
    );

    // Add 5 top-level comments to test truncation (should show first 3 + "X more")
    for (let i = 1; i <= 5; i++) {
      const comment = await ctx.createTestComment(
        testIssue.id,
        `Top-level comment #${i}`
      );

      // Add a reply to the first comment
      if (i === 1) {
        await ctx.createTestComment(
          testIssue.id,
          'Reply to first comment',
          comment.id
        );
      }
    }
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('shows comments by default (human-readable)', async () => {
    const result = await runCLI(['issues', 'get', testIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(testIssue.identifier);
    // Should show Comments section
    expect(result.stdout).toContain('Comments');
    // Should show first 3 top-level comments
    expect(result.stdout).toContain('Top-level comment #1');
    expect(result.stdout).toContain('Top-level comment #2');
    expect(result.stdout).toContain('Top-level comment #3');
    // Should show the reply to the first comment
    expect(result.stdout).toContain('Reply to first comment');
    // Should show "X more comments" message
    expect(result.stdout).toMatch(/\d+ more comments?/);
    // Should show hint to see all comments
    expect(result.stdout).toContain('linproj issues comments');
  });

  it('shows comments in JSON output', async () => {
    const result = await runCLI(
      ['issues', 'get', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.identifier).toBe(testIssue.identifier);
    expect(output.comments).toBeDefined();
    expect(Array.isArray(output.comments)).toBe(true);
    // Should be truncated to 3 top-level comments
    expect(output.comments.length).toBe(3);
    // Should include total count
    expect(output.totalComments).toBeGreaterThanOrEqual(6); // 5 top-level + 1 reply
  });

  it('excludes comments with --no-comments flag (human-readable)', async () => {
    const result = await runCLI(
      ['issues', 'get', testIssue.identifier, '--no-comments'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(testIssue.identifier);
    // Should NOT show Comments section
    expect(result.stdout).not.toContain('Top-level comment');
    expect(result.stdout).not.toContain('more comments');
  });

  it('excludes comments with --no-comments flag (JSON)', async () => {
    const result = await runCLI(
      ['issues', 'get', testIssue.identifier, '--no-comments', '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.identifier).toBe(testIssue.identifier);
    // Should NOT have comments field
    expect(output.comments).toBeUndefined();
    expect(output.totalComments).toBeUndefined();
  });

  it('handles issue with no comments', async () => {
    // Create a fresh issue with no comments
    const emptyIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] No Comments Issue ${Date.now()}`
    );

    const result = await runCLI(['issues', 'get', emptyIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(emptyIssue.identifier);
    expect(result.stdout).toContain('No comments');
  });

  it('handles issue with no comments (JSON)', async () => {
    // Create a fresh issue with no comments
    const emptyIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] No Comments Issue JSON ${Date.now()}`
    );

    const result = await runCLI(
      ['issues', 'get', emptyIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.identifier).toBe(emptyIssue.identifier);
    expect(output.comments).toEqual([]);
    expect(output.totalComments).toBe(0);
  });

  it('--field flag still works (does not include comments)', async () => {
    const result = await runCLI(
      ['issues', 'get', testIssue.identifier, '--field', 'url'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('linear.app');
    // Field output should be just the field value, no comments
    expect(result.stdout).not.toContain('Comments');
  });
});
