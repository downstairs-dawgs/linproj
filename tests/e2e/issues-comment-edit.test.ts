/**
 * E2E tests for issues comment edit and delete commands.
 *
 * Tests that editing and deleting comments works correctly.
 * Requires valid Linear authentication (LINEAR_API_KEY env var).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues comment edit E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comment edit E2E tests');
    }

    // Create a test issue for comment operations
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comment Edit E2E ${Date.now()}`
    );
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('edits own comment via argument', async () => {
    // Create a comment to edit
    const originalBody = `Original comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, originalBody);

    const newBody = `Edited comment ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comment', 'edit', comment.id, newBody],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Updated comment');
    expect(result.stdout).toContain('linear.app');

    // Verify the comment was actually updated
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);

    // Find the comment - it may be nested as a child or at root level
    const findComment = (comments: { id: string; body: string; children?: { id: string; body: string }[] }[]): { body: string } | undefined => {
      for (const c of comments) {
        if (c.id === comment.id) return c;
        if (c.children) {
          const found = findComment(c.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const updatedComment = findComment(output.comments);
    expect(updatedComment).toBeDefined();
    expect(updatedComment!.body).toBe(newBody);
  });

  it('edits own comment via stdin', async () => {
    // Create a comment to edit
    const originalBody = `Original stdin comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, originalBody);

    const newBody = `Stdin edited comment ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comment', 'edit', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! }, stdin: newBody }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Updated comment');

    // Verify the change
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);

    const findComment = (comments: { id: string; body: string; children?: { id: string; body: string }[] }[]): { body: string } | undefined => {
      for (const c of comments) {
        if (c.id === comment.id) return c;
        if (c.children) {
          const found = findComment(c.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const updatedComment = findComment(output.comments);
    expect(updatedComment).toBeDefined();
    expect(updatedComment!.body).toBe(newBody);
  });

  it('--json outputs updated comment as JSON', async () => {
    const originalBody = `JSON test comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, originalBody);

    const newBody = `JSON edited ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comment', 'edit', comment.id, newBody, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.id).toBe(comment.id);
    expect(output.body).toBe(newBody);
    expect(output.url).toContain('linear.app');
  });

  it('--quiet suppresses output', async () => {
    const originalBody = `Quiet test comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, originalBody);

    const newBody = `Quiet edited ${Date.now()}`;
    const result = await runCLI(
      ['issues', 'comment', 'edit', comment.id, newBody, '--quiet'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('reports no changes when content is unchanged', async () => {
    const body = `Unchanged comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'edit', comment.id, body],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No changes');
  });

  it('errors on comment not found', async () => {
    const result = await runCLI(
      ['issues', 'comment', 'edit', '00000000-0000-0000-0000-000000000000', 'new body'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Comment not found');
  });

  it('errors on empty body', async () => {
    const originalBody = `Empty body test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, originalBody);

    const result = await runCLI(
      ['issues', 'comment', 'edit', comment.id, ''],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    // Empty string argument triggers "New comment body required" error
    expect(result.stderr).toContain('body');
  });
});

describe('issues comment delete E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comment delete E2E tests');
    }

    // Create a test issue for comment operations
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comment Delete E2E ${Date.now()}`
    );
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('deletes own comment with --yes', async () => {
    const body = `Delete test comment ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'delete', comment.id, '--yes'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Comment deleted');

    // Verify the comment is gone
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);

    const findComment = (comments: { id: string; children?: { id: string }[] }[]): boolean => {
      for (const c of comments) {
        if (c.id === comment.id) return true;
        if (c.children && findComment(c.children)) return true;
      }
      return false;
    };

    expect(findComment(output.comments)).toBe(false);
  });

  it('--json outputs delete result as JSON', async () => {
    const body = `JSON delete test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'delete', comment.id, '--yes', '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.deleted).toBe(comment.id);
  });

  it('--quiet suppresses output', async () => {
    const body = `Quiet delete test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    const result = await runCLI(
      ['issues', 'comment', 'delete', comment.id, '--yes', '--quiet'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('errors on comment not found', async () => {
    const result = await runCLI(
      ['issues', 'comment', 'delete', '00000000-0000-0000-0000-000000000000', '--yes'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Comment not found');
  });

  it('cancels without --yes in non-TTY mode', async () => {
    const body = `No confirm test ${Date.now()}`;
    const comment = await ctx.createTestComment(testIssue.id, body);

    // In non-TTY mode without --yes, it should cancel
    // runCLI runs in non-TTY by default
    const result = await runCLI(
      ['issues', 'comment', 'delete', comment.id],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Delete cancelled');

    // Comment should still exist
    const listResult = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );
    const output = JSON.parse(listResult.stdout);

    const findComment = (comments: { id: string; children?: { id: string }[] }[]): boolean => {
      for (const c of comments) {
        if (c.id === comment.id) return true;
        if (c.children && findComment(c.children)) return true;
      }
      return false;
    };

    expect(findComment(output.comments)).toBe(true);
  });
});
