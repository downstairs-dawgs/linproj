/**
 * E2E tests for issues edit command with flags.
 *
 * These tests specifically verify that edit works with CLI flags when stdin
 * is a pipe (as happens when run by Claude Code or other automation tools).
 * This catches regressions in stdin detection.
 *
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { E2ETestContext, runCLI } from './harness.ts';
import { createIssue, getIssue, getViewer, LinearClient } from '../../src/lib/api.ts';

describe('issues edit with flags E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];
  let client: LinearClient;

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();
    client = await ctx.getLinearClient();

    if (teams.length < 1) {
      throw new Error('At least 1 team required for issues edit E2E tests');
    }
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

  it('edits issue with --priority flag (stdin is pipe with no data)', async () => {
    // This test verifies the fix for stdin detection.
    // When run via Bun.spawn (like Claude Code does), stdin is a pipe
    // but has no data. Previously this would error with:
    // "Cannot combine stdin input with mutation flags"

    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Edit flags ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    const result = await runCLI(
      ['issues', 'edit', issue.identifier, '--priority', 'high'],
      { env: ctx.envWithoutApiKey() }
    );

    // Should not fail with stdin error
    expect(result.stderr).not.toContain('Cannot combine stdin input');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✓');
    expect(result.stdout).toContain('priority');

    // Verify the change was applied
    const updated = await getIssue(client, issue.identifier);
    expect(updated?.priority).toBe(2); // high = 2
  });

  it('edits issue with --assignee flag', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Edit assignee ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    const result = await runCLI(
      ['issues', 'edit', issue.identifier, '--assignee', 'me'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.stderr).not.toContain('Cannot combine stdin input');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✓');
    expect(result.stdout).toContain('assignee');
  });

  it('edits issue with --assignee none', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    // Create issue assigned to me first
    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Edit unassign ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    // Assign to me
    await runCLI(
      ['issues', 'edit', issue.identifier, '--assignee', 'me'],
      { env: ctx.envWithoutApiKey() }
    );

    // Now unassign
    const result = await runCLI(
      ['issues', 'edit', issue.identifier, '--assignee', 'none'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.stderr).not.toContain('Cannot combine stdin input');
    expect(result.exitCode).toBe(0);

    const updated = await getIssue(client, issue.identifier);
    expect(updated?.assignee).toBeNull();
  });

  it('edits issue with multiple flags', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Edit multi ${Date.now()}`,
    });
    ctx.trackCreatedIssue(issue.identifier);

    const result = await runCLI(
      ['issues', 'edit', issue.identifier, '--priority', 'urgent', '--title', 'Updated Title'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.stderr).not.toContain('Cannot combine stdin input');
    expect(result.exitCode).toBe(0);

    const updated = await getIssue(client, issue.identifier);
    expect(updated?.priority).toBe(1); // urgent = 1
    expect(updated?.title).toBe('Updated Title');
  });

  it('unassigns issue with --assignee "" (empty string)', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    // Create issue assigned to me
    const viewer = await getViewer(client);
    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Unassign empty ${Date.now()}`,
      assigneeId: viewer.id,
    });
    ctx.trackCreatedIssue(issue.identifier);

    // Verify it's assigned
    const before = await getIssue(client, issue.identifier);
    expect(before?.assignee).not.toBeNull();

    // Unassign with empty string
    const result = await runCLI(
      ['issues', 'edit', issue.identifier, '--assignee', ''],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);

    const after = await getIssue(client, issue.identifier);
    expect(after?.assignee).toBeNull();
  });

  it('unassigns issue with --assignee none', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    // Create issue assigned to me
    const viewer = await getViewer(client);
    const issue = await createIssue(client, {
      teamId: testTeam.id,
      title: `[TEST] Unassign none ${Date.now()}`,
      assigneeId: viewer.id,
    });
    ctx.trackCreatedIssue(issue.identifier);

    // Verify it's assigned
    const before = await getIssue(client, issue.identifier);
    expect(before?.assignee).not.toBeNull();

    // Unassign with "none"
    const result = await runCLI(
      ['issues', 'edit', issue.identifier, '--assignee', 'none'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);

    const after = await getIssue(client, issue.identifier);
    expect(after?.assignee).toBeNull();
  });
});
