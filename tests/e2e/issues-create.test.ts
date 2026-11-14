/**
 * E2E tests for issues create command.
 *
 * Tests that default team and workspace selection work correctly.
 * Requires valid Linear authentication and will create/delete test issues.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { E2ETestContext, runCLI } from './harness.ts';
import {
  type LinearClient,
  createLabel,
  deleteLabel,
  getIssue,
  getViewer,
  getWorkflowStates,
} from '../../src/lib/api.ts';

interface ProjectWithTeams {
  id: string;
  name: string;
  teamIds: string[];
}

async function getProjectsWithTeams(client: LinearClient): Promise<ProjectWithTeams[]> {
  const result = await client.query<{
    projects: { nodes: { id: string; name: string; teams: { nodes: { id: string }[] } }[] };
  }>(`
    query {
      projects(first: 50) {
        nodes {
          id
          name
          teams {
            nodes {
              id
            }
          }
        }
      }
    }
  `);
  return result.projects.nodes.map((p) => ({
    id: p.id,
    name: p.name,
    teamIds: p.teams.nodes.map((t) => t.id),
  }));
}

describe('issues create E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();

    if (teams.length < 2) {
      throw new Error('At least 2 teams required for issues create E2E tests');
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

  it('uses default team from workspace', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const result = await runCLI(
      ['issues', 'create', '--title', `[TEST] Default team create ${Date.now()}`],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created issue');

    // Extract issue identifier and track for cleanup
    const match = result.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    ctx.trackCreatedIssue(issueIdentifier);

    // Verify issue was created in the default team
    expect(issueIdentifier.startsWith(testTeam.key)).toBe(true);
  });

  it('--workspace flag uses credentials from specified workspace', async () => {
    const defaultTeam = teams[0]!;
    const workspace2Team = teams[1]!;

    // Setup primary workspace
    await ctx.setupV2Config({ defaultTeam: defaultTeam.key });

    // Create second workspace with different default team
    const workspace2Id = 'workspace-2';
    const workspacesDir = join(ctx.configDir, 'workspaces');
    await mkdir(workspacesDir, { recursive: true });

    await writeFile(
      join(workspacesDir, `${workspace2Id}.json`),
      JSON.stringify({
        organizationId: workspace2Id,
        organizationName: 'Second Workspace',
        urlKey: 'workspace-2',
        auth: { type: 'api-key', apiKey: ctx.apiKey },
        defaultTeam: workspace2Team.key,
      })
    );

    const result = await runCLI(
      [
        'issues',
        'create',
        '--title',
        `[TEST] Workspace flag create ${Date.now()}`,
        '--workspace',
        'Second Workspace',
      ],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created issue');

    // Extract issue identifier and track for cleanup
    const match = result.stdout.match(/([A-Z]+-\d+):/);
    expect(match).not.toBeNull();

    const issueIdentifier = match![1]!;
    ctx.trackCreatedIssue(issueIdentifier);

    // Verify issue was created in workspace2's default team
    expect(issueIdentifier.startsWith(workspace2Team.key)).toBe(true);
  });

  it('creates a sub-issue with --parent', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const parentResult = await runCLI(
      ['issues', 'create', '--title', `[TEST] Parent issue ${Date.now()}`],
      { env: ctx.envWithoutApiKey() }
    );

    expect(parentResult.exitCode).toBe(0);
    const parentMatch = parentResult.stdout.match(/([A-Z]+-\d+):/);
    expect(parentMatch).not.toBeNull();
    const parentIdentifier = parentMatch![1]!;
    ctx.trackCreatedIssue(parentIdentifier);

    const childResult = await runCLI(
      [
        'issues',
        'create',
        '--title',
        `[TEST] Sub-issue ${Date.now()}`,
        '--parent',
        parentIdentifier,
      ],
      { env: ctx.envWithoutApiKey() }
    );

    expect(childResult.exitCode).toBe(0);
    expect(childResult.stdout).toContain('Created sub-issue');
    expect(childResult.stdout).toContain(`parent: ${parentIdentifier}`);

    const childMatch = childResult.stdout.match(/([A-Z]+-\d+):/);
    expect(childMatch).not.toBeNull();
    const childIdentifier = childMatch![1]!;
    ctx.trackCreatedIssue(childIdentifier);

    const client = await ctx.getLinearClient();
    const childIssue = await getIssue(client, childIdentifier);
    expect(childIssue).not.toBeNull();
    expect(childIssue!.parent?.identifier).toBe(parentIdentifier);
  });

  it('sets state, labels and assignee with --state, --label and --assignee', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const client = await ctx.getLinearClient();
    const states = await getWorkflowStates(client, testTeam.id);
    const state = states.find((s) => s.type === 'started')!;
    const label = await createLabel(client, { teamId: testTeam.id, name: `test-create-${Date.now()}` });

    try {
      const result = await runCLI(
        [
          'issues',
          'create',
          '--title',
          `[TEST] Create with fields ${Date.now()}`,
          '--state',
          state.name,
          '--label',
          label.name,
          '--assignee',
          'me',
        ],
        { env: ctx.envWithoutApiKey() }
      );

      expect(result.exitCode).toBe(0);
      const identifier = result.stdout.match(/([A-Z]+-\d+):/)![1]!;
      ctx.trackCreatedIssue(identifier);

      const issue = await getIssue(client, identifier);
      const viewer = await getViewer(client);
      expect(issue!.state.name).toBe(state.name);
      expect(issue!.labels!.nodes.map((l) => l.name)).toEqual([label.name]);
      expect(issue!.assignee?.id).toBe(viewer.id);
    } finally {
      await deleteLabel(client, label.id);
    }
  });

  it('puts the issue in the default project, and --project none overrides it', async () => {
    const client = await ctx.getLinearClient();
    const project = (await getProjectsWithTeams(client)).find((p) => p.teamIds.length > 0);
    if (!project) {
      throw new Error('At least 1 project with a team required for the default project E2E test');
    }
    const team = teams.find((t) => project.teamIds.includes(t.id))!;
    await ctx.setupV2Config({ defaultTeam: team.key, defaultProject: project.name });

    const withDefault = await runCLI(
      ['issues', 'create', '--title', `[TEST] Default project create ${Date.now()}`],
      { env: ctx.envWithoutApiKey() }
    );
    expect(withDefault.exitCode).toBe(0);
    const defaultIdentifier = withDefault.stdout.match(/([A-Z]+-\d+):/)![1]!;
    ctx.trackCreatedIssue(defaultIdentifier);

    const withNone = await runCLI(
      ['issues', 'create', '--title', `[TEST] No project create ${Date.now()}`, '--project', 'none'],
      { env: ctx.envWithoutApiKey() }
    );
    expect(withNone.exitCode).toBe(0);
    const noneIdentifier = withNone.stdout.match(/([A-Z]+-\d+):/)![1]!;
    ctx.trackCreatedIssue(noneIdentifier);

    expect((await getIssue(client, defaultIdentifier))!.project?.id).toBe(project.id);
    expect((await getIssue(client, noneIdentifier))!.project).toBeFalsy();
  });

  it('explains a default project that is not in the issue team', async () => {
    const client = await ctx.getLinearClient();
    const projects = await getProjectsWithTeams(client);
    let pair: { project: ProjectWithTeams; teamKey: string } | undefined;
    for (const project of projects) {
      const otherTeam = teams.find((t) => !project.teamIds.includes(t.id));
      if (otherTeam) {
        pair = { project, teamKey: otherTeam.key };
        break;
      }
    }
    if (!pair) {
      throw new Error('A project outside at least one team is required for this E2E test');
    }
    await ctx.setupV2Config({ defaultTeam: pair.teamKey, defaultProject: pair.project.name });

    const result = await runCLI(
      ['issues', 'create', '--title', `[TEST] Should fail ${Date.now()}`],
      { env: ctx.envWithoutApiKey() }
    );

    const created = result.stdout.match(/([A-Z]+-\d+):/);
    if (created) {
      ctx.trackCreatedIssue(created[1]!);
    }
    expect(result.exitCode).toBe(1);
    expect(result.stderr.trim()).toBe(
      `Error: The default project '${pair.project.name}' is not in team ${pair.teamKey}. ` +
        'Pass --project <name> for a project in that team, or --project none.'
    );
  });

  it('rejects an unknown state before creating the issue', async () => {
    const testTeam = teams[0]!;
    await ctx.setupV2Config({ defaultTeam: testTeam.key });

    const result = await runCLI(
      ['issues', 'create', '--title', '[TEST] Should fail', '--state', 'No Such State'],
      { env: ctx.envWithoutApiKey() }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("State 'No Such State' not found");
  });

  it('fails when no team specified, no default, and no TTY', async () => {
    // Setup workspace without default team
    await ctx.setupV2Config();

    const result = await runCLI(
      ['issues', 'create', '--title', '[TEST] Should fail'],
      { env: ctx.envWithoutApiKey() }
    );

    // Without a TTY, can't prompt for team selection
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Interactive selection requires a TTY');
  });
});
