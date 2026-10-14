/**
 * E2E tests for the parent and sub-issues shown by issues get.
 *
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';
import { createIssue } from '../../src/lib/api.ts';

describe('issues get sub-issues E2E', () => {
  const ctx = new E2ETestContext();
  let parentIdentifier: string;
  let parentTitle: string;
  let childIdentifier: string;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();

    const client = await ctx.getLinearClient();
    const team = (await ctx.getTeams())[0]!;

    parentTitle = `[TEST] Sub-issues parent ${Date.now()}`;
    const parent = await ctx.createTestIssue(team.id, parentTitle);
    parentIdentifier = parent.identifier;

    const child = await createIssue(client, {
      teamId: team.id,
      title: `[TEST] Sub-issues child ${Date.now()}`,
      parentId: parent.id,
    });
    childIdentifier = child.identifier;
    ctx.trackCreatedIssue(childIdentifier);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it('lists sub-issues of a parent issue', async () => {
    const result = await runCLI(['issues', 'get', parentIdentifier, '--no-comments']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Sub-issues (1, 1 open):');
    expect(result.stdout).toContain(childIdentifier);
  });

  it('shows the parent of a sub-issue with its title', async () => {
    const result = await runCLI(['issues', 'get', childIdentifier, '--no-comments']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Parent:    ${parentIdentifier} ${parentTitle}`);
    expect(result.stdout).not.toContain('Sub-issues (');
  });

  it('includes sub-issues in JSON output', async () => {
    const result = await runCLI(['issues', 'get', parentIdentifier, '--json', '--no-comments']);

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.subIssues.map((s: { identifier: string }) => s.identifier)).toEqual([childIdentifier]);
  });

  it('includes the parent title in JSON output', async () => {
    const result = await runCLI(['issues', 'get', childIdentifier, '--json', '--no-comments']);

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.parent.identifier).toBe(parentIdentifier);
    expect(output.parent.title).toBe(parentTitle);
  });

  it('outputs the parent identifier with --field parent', async () => {
    const result = await runCLI(['issues', 'get', childIdentifier, '--field', 'parent']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(parentIdentifier);
  });
});
