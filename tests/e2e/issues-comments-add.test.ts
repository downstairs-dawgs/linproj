/**
 * E2E tests for issues comments add command.
 *
 * Tests that adding comments to issues works correctly.
 * Requires valid Linear authentication (LINEAR_API_KEY env var).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues comments add E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comments E2E tests');
    }

    // Create a test issue for adding comments
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comments Add E2E ${Date.now()}`
    );
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('adds comment via inline argument', async () => {
    const commentBody = `Test comment ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier, commentBody],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    // Default output is the comment URL
    expect(result.stdout).toContain('linear.app');
    expect(result.stdout.trim()).toMatch(/^https:\/\/linear\.app\/.+/);

    // Verify the comment was actually created
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);
    const found = output.comments.some((c: { body: string }) =>
      c.body.includes(commentBody)
    );
    expect(found).toBe(true);
  });

  it('adds comment via stdin', async () => {
    const timestamp = Date.now();
    const commentBody = `Stdin comment ${timestamp}`;

    const result = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier],
      { env: { LINEAR_API_KEY: ctx.apiKey! }, stdin: commentBody }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('linear.app');

    // Verify the comment was created
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);
    const found = output.comments.some(
      (c: { body: string }) => c.body.includes(`Stdin comment ${timestamp}`)
    );
    expect(found).toBe(true);
  });

  it('--reply-to creates threaded reply', async () => {
    // First create a parent comment
    const parentBody = `Parent comment for reply test ${Date.now()}`;
    const parentResult = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier, parentBody, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(parentResult.exitCode).toBe(0);
    const parentComment = JSON.parse(parentResult.stdout);
    const parentId = parentComment.id;

    // Now create a reply to that comment
    const replyBody = `Reply to parent ${Date.now()}`;
    const replyResult = await runCLI(
      [
        'issues',
        'comments',
        'add',
        testIssue.identifier,
        replyBody,
        '--reply-to',
        parentId,
        '--json',
      ],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(replyResult.exitCode).toBe(0);
    const replyComment = JSON.parse(replyResult.stdout);
    expect(replyComment.parentId).toBe(parentId);

    // Verify threading in the list output
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);

    // Find the parent and check it has the reply as a child
    const parent = output.comments.find((c: { id: string }) => c.id === parentId);
    expect(parent).toBeDefined();
    expect(parent.children.length).toBeGreaterThan(0);
    const reply = parent.children.find((c: { body: string }) =>
      c.body.includes('Reply to parent')
    );
    expect(reply).toBeDefined();
  });

  it('--reply-to last replies to most recent comment', async () => {
    // Create a comment to be the "last" one
    const lastCommentBody = `Last comment for --reply-to last test ${Date.now()}`;
    const lastResult = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier, lastCommentBody, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    expect(lastResult.exitCode).toBe(0);
    const lastComment = JSON.parse(lastResult.stdout);

    // Now reply to "last"
    const replyBody = `Reply to last ${Date.now()}`;
    const replyResult = await runCLI(
      [
        'issues',
        'comments',
        'add',
        testIssue.identifier,
        replyBody,
        '--reply-to',
        'last',
        '--json',
      ],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(replyResult.exitCode).toBe(0);
    const replyComment = JSON.parse(replyResult.stdout);
    expect(replyComment.parentId).toBe(lastComment.id);
  });

  it('--json outputs created comment as JSON', async () => {
    const commentBody = `JSON output test ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier, commentBody, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const comment = JSON.parse(result.stdout);
    expect(comment.id).toBeDefined();
    expect(comment.body).toBe(commentBody);
    expect(comment.createdAt).toBeDefined();
    expect(comment.url).toContain('linear.app');
    expect(comment.user).toBeDefined();
  });

  it('--quiet suppresses output', async () => {
    const commentBody = `Quiet test ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier, commentBody, '--quiet'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');

    // But the comment should still be created
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);
    const found = output.comments.some((c: { body: string }) =>
      c.body.includes('Quiet test')
    );
    expect(found).toBe(true);
  });

  it('errors on empty comment body', async () => {
    const result = await runCLI(
      ['issues', 'comments', 'add', testIssue.identifier, ''],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Comment body cannot be empty');
  });

  it('errors on issue not found', async () => {
    const result = await runCLI(
      ['issues', 'comments', 'add', 'NONEXISTENT-99999', 'test comment'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  it('errors when --reply-to last has no comments', async () => {
    // Create a new issue with no comments
    const emptyIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] No Comments for Reply ${Date.now()}`
    );

    const result = await runCLI(
      [
        'issues',
        'comments',
        'add',
        emptyIssue.identifier,
        'test reply',
        '--reply-to',
        'last',
      ],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No comments to reply to');
  });
});
