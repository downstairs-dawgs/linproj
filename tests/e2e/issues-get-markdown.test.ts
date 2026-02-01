/**
 * E2E tests for markdown rendering in issues get command.
 *
 * Tests that markdown descriptions are rendered properly with ANSI styling,
 * and that --raw flag bypasses rendering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';
import { createIssue } from '../../src/lib/api.ts';

describe('issues get markdown rendering E2E', () => {
  const ctx = new E2ETestContext();
  let testIssueIdentifier: string;
  let testIssueId: string;

  const markdownDescription = `## Problem

The \`fetchUsers\` function throws an error.

### Steps to reproduce

1. Call the function
2. Wait for timeout
   - Note: happens consistently

**Expected**: Success
**Actual**: Failure

See [the docs](https://example.com) for more info.`;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    // Create a test issue with markdown description
    const client = await ctx.getLinearClient();
    const teams = await ctx.getTeams();
    const team = teams[0]!;

    const issue = await createIssue(client, {
      teamId: team.id,
      title: `[TEST] Markdown rendering test ${Date.now()}`,
      description: markdownDescription,
    });

    testIssueIdentifier = issue.identifier;
    testIssueId = issue.id;
    ctx.trackCreatedIssue(testIssueIdentifier);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('renders markdown with structural formatting', async () => {
    const result = await runCLI(['issues', 'get', testIssueIdentifier, '--no-comments']);

    expect(result.exitCode).toBe(0);

    // Note: Non-TTY mode disables ANSI colors, but structural elements remain

    // Should render bullets for unordered list (nested item)
    expect(result.stdout).toContain('•');

    // Should render numbered list
    expect(result.stdout).toContain('1.');
    expect(result.stdout).toContain('2.');

    // Should render the link text and URL
    expect(result.stdout).toContain('the docs');
    expect(result.stdout).toContain('https://example.com');

    // Headings should be present
    expect(result.stdout).toContain('## Problem');
    expect(result.stdout).toContain('### Steps');
  });

  it('shows raw markdown with --raw flag', async () => {
    const result = await runCLI(['issues', 'get', testIssueIdentifier, '--raw', '--no-comments']);

    expect(result.exitCode).toBe(0);

    // Should NOT contain ANSI escape codes
    expect(result.stdout).not.toContain('\x1b[');

    // Should contain markdown syntax (Linear may normalize slightly)
    expect(result.stdout).toContain('## Problem');
    expect(result.stdout).toContain('`fetchUsers`');
    expect(result.stdout).toContain('**Expected**');
    expect(result.stdout).toContain('[the docs]');

    // Raw mode should NOT render bullets as •
    expect(result.stdout).not.toContain('•');
  });

  it('outputs raw markdown in JSON mode', async () => {
    const result = await runCLI(['issues', 'get', testIssueIdentifier, '--json', '--no-comments']);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);

    // JSON should contain raw markdown (Linear may normalize slightly)
    expect(output.description).toContain('## Problem');
    expect(output.description).toContain('`fetchUsers`');
    expect(output.description).toContain('**Expected**');

    // JSON should not contain ANSI codes
    expect(output.description).not.toContain('\x1b[');

    // JSON should not contain rendered bullets
    expect(output.description).not.toContain('•');
  });

  it('renders code spans with backticks preserved', async () => {
    const result = await runCLI(['issues', 'get', testIssueIdentifier, '--no-comments']);

    expect(result.exitCode).toBe(0);

    // Code spans should have backticks in output
    expect(result.stdout).toContain('`fetchUsers`');
  });

  it('renders nested list items with indentation', async () => {
    const result = await runCLI(['issues', 'get', testIssueIdentifier, '--no-comments']);

    expect(result.exitCode).toBe(0);

    // Nested item should be indented (2 spaces before bullet)
    expect(result.stdout).toContain('  •');
  });
});
