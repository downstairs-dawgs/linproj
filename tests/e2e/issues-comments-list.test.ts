/**
 * E2E tests for issues comments list command.
 *
 * Tests that listing comments on issues works correctly.
 * Requires valid Linear authentication (LINEAR_API_KEY env var).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues comments list E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];
  let parentCommentId: string;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comments E2E tests');
    }

    // Create a test issue with comments
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comments E2E ${Date.now()}`
    );

    // Add some test comments
    const comment1 = await ctx.createTestComment(
      testIssue.id,
      'This is the first test comment'
    );
    parentCommentId = comment1.id;

    // Add a reply to the first comment
    await ctx.createTestComment(
      testIssue.id,
      'This is a reply to the first comment',
      parentCommentId
    );

    // Add another top-level comment
    await ctx.createTestComment(
      testIssue.id,
      'This is the second top-level comment'
    );
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('lists comments on issue (human-readable)', async () => {
    const result = await runCLI(['issues', 'comments', testIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(testIssue.identifier);
    expect(result.stdout).toContain('first test comment');
    expect(result.stdout).toContain('reply to the first comment');
    expect(result.stdout).toContain('second top-level comment');
    // Should show comment count
    expect(result.stdout).toMatch(/\d+ comments?:/);
  });

  it('outputs JSON with --json flag', async () => {
    const result = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.issue).toBeDefined();
    expect(output.issue.identifier).toBe(testIssue.identifier);
    expect(output.comments).toBeDefined();
    expect(Array.isArray(output.comments)).toBe(true);
    expect(output.totalCount).toBeGreaterThanOrEqual(3);

    // Verify comment structure
    const firstComment = output.comments[0];
    expect(firstComment.id).toBeDefined();
    expect(firstComment.body).toBeDefined();
    expect(firstComment.createdAt).toBeDefined();
    expect(firstComment.url).toBeDefined();
  });

  it('--limit restricts top-level comments', async () => {
    const result = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--limit', '1', '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    // Should only have 1 top-level comment (but may include its replies)
    expect(output.comments.length).toBe(1);
  });

  it('displays threaded replies correctly in JSON', async () => {
    const result = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);

    // Find the parent comment with children
    const parentComment = output.comments.find(
      (c: { children: unknown[] }) => c.children && c.children.length > 0
    );
    expect(parentComment).toBeDefined();
    expect(parentComment.body).toContain('first test comment');
    expect(parentComment.children[0].body).toContain('reply to the first comment');
  });

  it('errors on issue not found', async () => {
    const result = await runCLI(['issues', 'comments', 'NONEXISTENT-99999'], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('handles issue with no comments', async () => {
    // Create a fresh issue with no comments
    const emptyIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] No Comments ${Date.now()}`
    );

    const result = await runCLI(['issues', 'comments', emptyIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No comments');
  });

  it('handles issue with no comments (JSON)', async () => {
    // Create a fresh issue with no comments
    const emptyIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] No Comments JSON ${Date.now()}`
    );

    const result = await runCLI(
      ['issues', 'comments', emptyIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.comments).toEqual([]);
    expect(output.totalCount).toBe(0);
  });
});
