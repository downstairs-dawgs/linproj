import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupPolly, stopPolly } from '../setup.ts';
import { Polly } from '@pollyjs/core';
import {
  LinearClient,
  getViewer,
  getTeams,
  getAssignedIssues,
  getIssue,
  listIssues,
  searchIssues,
  createIssue,
  deleteIssue,
} from '../../src/lib/api.ts';
import { readConfig, type ApiKeyAuth } from '../../src/lib/config.ts';

// Get auth for tests
async function getTestAuth(): Promise<ApiKeyAuth> {
  // In replay mode, use dummy key (auth headers aren't matched)
  if (process.env.POLLY_MODE !== 'record') {
    return { type: 'api-key', apiKey: 'test-key' };
  }

  // In record mode, need real credentials
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    return { type: 'api-key', apiKey: envKey };
  }

  const config = await readConfig();
  if (config.auth?.type === 'api-key') {
    return config.auth;
  }

  throw new Error(
    'No API key found. Set LINEAR_API_KEY env var or run `linproj auth login`'
  );
}

describe('Linear API', () => {
  let polly: Polly;
  let client: LinearClient;

  beforeEach(async () => {
    const auth = await getTestAuth();
    client = new LinearClient(auth);
  });

  afterEach(async () => {
    if (polly) {
      await stopPolly(polly);
    }
  });

  describe('getViewer', () => {
    beforeEach(() => {
      polly = setupPolly('get-viewer');
    });

    it('returns the authenticated user', async () => {
      const viewer = await getViewer(client);

      expect(viewer).toBeDefined();
      expect(viewer.id).toBeDefined();
      expect(viewer.name).toBeDefined();
      expect(viewer.email).toBeDefined();
    });
  });

  describe('getTeams', () => {
    beforeEach(() => {
      polly = setupPolly('get-teams');
    });

    it('returns available teams', async () => {
      const teams = await getTeams(client);

      expect(teams).toBeDefined();
      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBeGreaterThan(0);

      const team = teams[0]!;
      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
      expect(team.key).toBeDefined();
    });
  });

  describe('getAssignedIssues', () => {
    beforeEach(() => {
      polly = setupPolly('get-assigned-issues');
    });

    it('returns issues assigned to the user', async () => {
      const issues = await getAssignedIssues(client, 10);

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      // May be empty if no issues assigned
    });
  });

  describe('createIssue and deleteIssue', () => {
    beforeEach(() => {
      polly = setupPolly('create-delete-issue');
    });

    it('creates and deletes an issue', async () => {
      // Get a team first
      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);
      const teamId = teams[0]!.id;

      // Create issue
      const issue = await createIssue(client, {
        teamId,
        title: '[TEST] Integration test issue',
        description: 'This issue was created by an integration test and should be deleted.',
      });

      expect(issue).toBeDefined();
      expect(issue.id).toBeDefined();
      expect(issue.identifier).toBeDefined();
      expect(issue.title).toBe('[TEST] Integration test issue');

      // Delete issue
      const deleted = await deleteIssue(client, issue.id);
      expect(deleted).toBe(true);
    });
  });

  describe('getIssue', () => {
    it('retrieves an issue by identifier', async () => {
      polly = setupPolly('get-issue-by-id');

      // First create an issue to retrieve
      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);
      const teamId = teams[0]!.id;

      const created = await createIssue(client, {
        teamId,
        title: '[TEST] Get issue test',
        description: 'Testing getIssue functionality',
      });

      try {
        // Retrieve the issue
        const issue = await getIssue(client, created.identifier);

        expect(issue).toBeDefined();
        expect(issue!.id).toBe(created.id);
        expect(issue!.identifier).toBe(created.identifier);
        expect(issue!.title).toBe('[TEST] Get issue test');
        expect(issue!.url).toContain('linear.app');
        expect(issue!.state).toBeDefined();
        expect(issue!.state.name).toBeDefined();
        expect(issue!.state.type).toBeDefined();
      } finally {
        // Cleanup
        await deleteIssue(client, created.id);
      }
    });

    it('returns null for nonexistent issue', async () => {
      polly = setupPolly('get-issue-nonexistent');

      const issue = await getIssue(client, 'NONEXISTENT-99999');
      expect(issue).toBeNull();
    });
  });

  describe('listIssues', () => {
    it('lists issues without filter', async () => {
      polly = setupPolly('list-issues-no-filter');

      const issues = await listIssues(client, undefined, 10);

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
    });

    it('filters by team', async () => {
      polly = setupPolly('list-issues-by-team');

      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);
      const teamKey = teams[0]!.key;

      const issues = await listIssues(
        client,
        { team: { key: { eq: teamKey } } },
        10
      );

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      // All returned issues should belong to the specified team
      for (const issue of issues) {
        expect(issue.team?.key).toBe(teamKey);
      }
    });

    it('filters by state type', async () => {
      polly = setupPolly('list-issues-by-state-type');

      const issues = await listIssues(
        client,
        { state: { type: { eq: 'started' } } },
        10
      );

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      // All returned issues should have started state type
      for (const issue of issues) {
        expect(issue.state.type).toBe('started');
      }
    });

    it('filters by assignee', async () => {
      polly = setupPolly('list-issues-by-assignee');

      const viewer = await getViewer(client);

      const issues = await listIssues(
        client,
        { assignee: { id: { eq: viewer.id } } },
        10
      );

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      // All returned issues should be assigned to the viewer
      for (const issue of issues) {
        expect(issue.assignee?.id).toBe(viewer.id);
      }
    });
  });

  describe('searchIssues', () => {
    it('finds issues matching query', async () => {
      polly = setupPolly('search-issues-matching');

      // Create an issue to search for
      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);
      const teamId = teams[0]!.id;

      const created = await createIssue(client, {
        teamId,
        title: '[TEST] Search test issue',
        description: 'Testing searchIssues functionality',
      });

      try {
        // Search for the issue
        const issues = await searchIssues(client, 'Search test', undefined, 25);

        expect(issues).toBeDefined();
        expect(Array.isArray(issues)).toBe(true);
      } finally {
        // Cleanup
        await deleteIssue(client, created.id);
      }
    });

    it('returns empty array for no matches', async () => {
      polly = setupPolly('search-issues-no-matches');

      const issues = await searchIssues(
        client,
        'xyznonexistentquery123456789',
        undefined,
        10
      );

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBe(0);
    });

    it('respects team filter', async () => {
      polly = setupPolly('search-issues-with-team-filter');

      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);
      const teamKey = teams[0]!.key;

      const issues = await searchIssues(
        client,
        'test',
        { team: { key: { eq: teamKey } } },
        10
      );

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      // All returned issues should belong to the specified team
      for (const issue of issues) {
        expect(issue.team?.key).toBe(teamKey);
      }
    });
  });
});
