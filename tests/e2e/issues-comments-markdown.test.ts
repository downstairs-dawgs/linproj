/**
 * E2E tests for markdown rendering in comments.
 *
 * Tests that comment bodies are rendered properly with ANSI styling,
 * and that --raw flag bypasses rendering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';

describe('issues comments markdown rendering E2E', () => {
  const ctx = new E2ETestContext();
  let testIssue: { id: string; identifier: string };

  const markdownComment = `## Summary

The \`fetchData\` function is failing.

### Details

- First item
- Second item
  - Nested item

**Important**: Check [the docs](https://example.com) for reference.`;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    const teams = await ctx.getTeams();
    if (teams.length === 0) {
      throw new Error('At least 1 team required for comments markdown E2E tests');
    }

    // Create a test issue
    testIssue = await ctx.createTestIssue(
      teams[0]!.id,
      `[TEST] Comments Markdown ${Date.now()}`
    );

    // Add a comment with markdown content
    await ctx.createTestComment(testIssue.id, markdownComment);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('renders markdown with structural formatting in comments', async () => {
    const result = await runCLI(['issues', 'comments', testIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);

    // Should render bullets for unordered list
    expect(result.stdout).toContain('•');

    // Should render code spans with backticks preserved
    expect(result.stdout).toContain('`fetchData`');

    // Should render the link text and URL
    expect(result.stdout).toContain('the docs');
    expect(result.stdout).toContain('https://example.com');

    // Headings should be present
    expect(result.stdout).toContain('## Summary');
    expect(result.stdout).toContain('### Details');
  });

  it('renders nested list items with indentation', async () => {
    const result = await runCLI(['issues', 'comments', testIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);

    // Nested item should be indented (2 spaces before bullet)
    expect(result.stdout).toContain('  •');
  });

  it('shows raw markdown with --raw flag', async () => {
    const result = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--raw'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    // Should NOT contain ANSI escape codes
    expect(result.stdout).not.toContain('\x1b[');

    // Should contain markdown syntax
    expect(result.stdout).toContain('## Summary');
    expect(result.stdout).toContain('`fetchData`');
    expect(result.stdout).toContain('**Important**');
    expect(result.stdout).toContain('[the docs]');

    // Raw mode should NOT render bullets as •
    expect(result.stdout).not.toContain('•');
  });

  it('outputs raw markdown in JSON mode', async () => {
    const result = await runCLI(
      ['issues', 'comments', testIssue.identifier, '--json'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.comments).toBeDefined();
    expect(output.comments.length).toBeGreaterThan(0);

    // Find the comment with our markdown content
    const mdComment = output.comments.find((c: { body: string }) =>
      c.body.includes('fetchData')
    );
    expect(mdComment).toBeDefined();

    // JSON should contain raw markdown
    expect(mdComment.body).toContain('## Summary');
    expect(mdComment.body).toContain('`fetchData`');
    expect(mdComment.body).toContain('**Important**');

    // JSON should not contain ANSI codes
    expect(mdComment.body).not.toContain('\x1b[');

    // JSON should not contain rendered bullets
    expect(mdComment.body).not.toContain('•');
  });

  it('renders markdown in comments from issues get', async () => {
    const result = await runCLI(['issues', 'get', testIssue.identifier], {
      env: { LINEAR_API_KEY: ctx.apiKey! },
    });

    expect(result.exitCode).toBe(0);

    // Comments section should have rendered markdown
    expect(result.stdout).toContain('•');
    expect(result.stdout).toContain('`fetchData`');
  });

  it('shows raw markdown in issues get with --raw flag', async () => {
    const result = await runCLI(
      ['issues', 'get', testIssue.identifier, '--raw'],
      { env: { LINEAR_API_KEY: ctx.apiKey! } }
    );

    expect(result.exitCode).toBe(0);

    // Raw mode should NOT render bullets as •
    expect(result.stdout).not.toContain('•');

    // Should contain raw markdown syntax
    expect(result.stdout).toContain('`fetchData`');
    expect(result.stdout).toContain('**Important**');
  });
});
