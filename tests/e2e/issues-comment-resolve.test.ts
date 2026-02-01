/**
 * E2E tests for issues comment resolve and unresolve commands.
 *
 * Tests that resolving and unresolving comment threads works correctly.
 * Requires valid Linear authentication (LINEAR_API_KEY env var).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI, findCommentInTree } from './harness.ts';

describe('issues comment resolve E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comment resolve E2E tests');
    }

    // Create a test issue for comment operations
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comment Resolve E2E ${Date.now()}`
    );
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('resolves a comment thread', async () => {
    const body = `Resolve test comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Resolved comment');
    expect(result.stdout).toContain('linear.app');

    // Verify the comment is now resolved via list
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);
    const resolvedComment = findCommentInTree(output.comments, comment.id);
    expect(resolvedComment).toBeDefined();
    expect(resolvedComment!.resolvingUser).toBeDefined();
  });

  it('reports already resolved when resolving again', async () => {
    const body = `Already resolved test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // First resolve
    await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    // Try to resolve again
    const result = await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('already resolved');
  });

  it('--json outputs resolved comment as JSON', async () => {
    const body = `JSON resolve test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'resolve', comment.id, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.id).toBe(comment.id);
    expect(output.resolvingUser).toBeDefined();
    expect(output.url).toContain('linear.app');
  });

  it('--quiet suppresses output', async () => {
    const body = `Quiet resolve test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'resolve', comment.id, '--quiet'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('errors on comment not found', async () => {
    const result = await runCLI(
      ['issues', 'comment', 'resolve', '00000000-0000-0000-0000-000000000000'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Comment not found');
  });

  it('shows collapsed resolved thread in human-readable list output', async () => {
    const body = `Human readable resolve test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // Resolve the comment
    await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    // List without --json to check human-readable output
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(listResult.exitCode).toBe(0);
    // Resolved threads show collapsed with checkmark and preview quote
    expect(listResult.stdout).toContain('✓');
    expect(listResult.stdout).toContain('"Human readable resolve test');
  });

  it('shows collapsed resolved thread with reply count', async () => {
    const body = `Resolved with replies test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // Add replies to the comment
    await ctx.createTestComment(testIssue.id, 'First reply', comment.id);
    await ctx.createTestComment(testIssue.id, 'Second reply', comment.id);

    // Resolve the thread
    await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    // List without --json to check human-readable output
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(listResult.exitCode).toBe(0);
    // Collapsed view should show reply count
    expect(listResult.stdout).toContain('✓');
    expect(listResult.stdout).toContain('+ 2 replies');
    expect(listResult.stdout).toContain('"Resolved with replies test');
  });
});

describe('issues comment unresolve E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comment unresolve E2E tests');
    }

    // Create a test issue for comment operations
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comment Unresolve E2E ${Date.now()}`
    );
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('unresolves a resolved comment', async () => {
    const body = `Unresolve test comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // First resolve
    await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    // Now unresolve
    const result = await runCLI(
      ['issues', 'comment', 'unresolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Unresolved comment');
    expect(result.stdout).toContain('linear.app');

    // Verify the comment is no longer resolved via list
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);
    const unresolvedComment = findCommentInTree(output.comments, comment.id);
    expect(unresolvedComment).toBeDefined();
    expect(unresolvedComment!.resolvingUser).toBeNull();
  });

  it('reports not resolved when unresolving unresolved comment', async () => {
    const body = `Not resolved test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // Try to unresolve without first resolving
    const result = await runCLI(
      ['issues', 'comment', 'unresolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('not resolved');
  });

  it('--json outputs unresolved comment as JSON', async () => {
    const body = `JSON unresolve test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // First resolve
    await runCLI(
      ['issues', 'comment', 'resolve', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    // Now unresolve with --json
    const result = await runCLI(
      ['issues', 'comment', 'unresolve', comment.id, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.id).toBe(comment.id);
    expect(output.resolvingUser).toBeNull();
    expect(output.url).toContain('linear.app');
  });

  it('--quiet suppresses output', async () => {
    const body = `Quiet unresolve test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // Resolve first
    await runCLI(
      ['issues', 'comment', 'resolve', comment.id, '--quiet'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    // Unresolve with --quiet
    const result = await runCLI(
      ['issues', 'comment', 'unresolve', comment.id, '--quiet'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('errors on comment not found', async () => {
    const result = await runCLI(
      ['issues', 'comment', 'unresolve', '00000000-0000-0000-0000-000000000000'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Comment not found');
  });
});
