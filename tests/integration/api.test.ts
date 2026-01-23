import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupPolly, stopPolly } from '../setup.ts';
import { Polly } from '@pollyjs/core';
import {
  LinearClient,
  getViewer,
  getTeams,
  getAssignedIssues,
  createIssue,
  deleteIssue,
} from '../../src/lib/api.ts';
import { readConfig, type ApiKeyAuth } from '../../src/lib/config.ts';

// Get auth for tests - uses stored config or env var
async function getTestAuth(): Promise<ApiKeyAuth> {
  // First try environment variable (for CI)
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    return { type: 'api-key', apiKey: envKey };
  }

  // Fall back to stored config (for local dev)
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
});
