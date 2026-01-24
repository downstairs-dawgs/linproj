import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupPolly, stopPolly } from '../setup.ts';
import { Polly } from '@pollyjs/core';
import {
  LinearClient,
  getIssue,
  updateIssue,
  getWorkflowStates,
  getLabels,
  getViewer,
} from '../../src/lib/api.ts';
import { readConfig, type ApiKeyAuth } from '../../src/lib/config.ts';
import {
  resolveState,
  resolveLabels,
  resolveAssignee,
  resolvePriority,
} from '../../src/lib/resolve.ts';

async function getTestAuth(): Promise<ApiKeyAuth> {
  if (process.env.POLLY_MODE !== 'record') {
    return { type: 'api-key', apiKey: 'test-key' };
  }

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

describe('resolvePriority', () => {
  it('resolves none to 0', () => {
    expect(resolvePriority('none')).toBe(0);
  });

  it('resolves urgent to 1', () => {
    expect(resolvePriority('urgent')).toBe(1);
  });

  it('resolves high to 2', () => {
    expect(resolvePriority('high')).toBe(2);
  });

  it('resolves medium to 3', () => {
    expect(resolvePriority('medium')).toBe(3);
  });

  it('resolves low to 4', () => {
    expect(resolvePriority('low')).toBe(4);
  });

  it('is case-insensitive', () => {
    expect(resolvePriority('HIGH')).toBe(2);
    expect(resolvePriority('Low')).toBe(4);
    expect(resolvePriority('URGENT')).toBe(1);
  });

  it('throws for invalid priority', () => {
    expect(() => resolvePriority('invalid')).toThrow(/Invalid priority/);
  });
});

describe('Issue Edit API', () => {
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

  describe('getWorkflowStates', () => {
    beforeEach(() => {
      polly = setupPolly('get-workflow-states');
    });

    it('returns workflow states for a team', async () => {
      // This test requires a valid team ID from recordings
      // In record mode, we need to get a real team first
      const issue = await getIssue(client, 'MRP-1');
      if (!issue?.team) {
        console.log('Skipping: no test issue available');
        return;
      }

      // Get the team ID by resolving the team key
      const { resolveTeam } = await import('../../src/lib/resolve.ts');
      const teamId = await resolveTeam(client, issue.team.key);

      const states = await getWorkflowStates(client, teamId);

      expect(Array.isArray(states)).toBe(true);
      expect(states.length).toBeGreaterThan(0);
      expect(states[0]).toHaveProperty('id');
      expect(states[0]).toHaveProperty('name');
      expect(states[0]).toHaveProperty('type');
    });
  });

  describe('getLabels', () => {
    beforeEach(() => {
      polly = setupPolly('get-labels');
    });

    it('returns labels for a team', async () => {
      const issue = await getIssue(client, 'MRP-1');
      if (!issue?.team) {
        console.log('Skipping: no test issue available');
        return;
      }

      const { resolveTeam } = await import('../../src/lib/resolve.ts');
      const teamId = await resolveTeam(client, issue.team.key);

      const labels = await getLabels(client, teamId);

      expect(Array.isArray(labels)).toBe(true);
      // Labels might be empty for some teams
      if (labels.length > 0) {
        expect(labels[0]).toHaveProperty('id');
        expect(labels[0]).toHaveProperty('name');
        expect(labels[0]).toHaveProperty('color');
      }
    });
  });

  describe('resolveState', () => {
    beforeEach(() => {
      polly = setupPolly('resolve-state');
    });

    it('resolves state name to ID', async () => {
      const issue = await getIssue(client, 'MRP-1');
      if (!issue?.team) {
        console.log('Skipping: no test issue available');
        return;
      }

      const { resolveTeam } = await import('../../src/lib/resolve.ts');
      const teamId = await resolveTeam(client, issue.team.key);

      const stateId = await resolveState(client, teamId, issue.state.name);

      expect(typeof stateId).toBe('string');
      expect(stateId.length).toBeGreaterThan(0);
    });

    it('is case-insensitive', async () => {
      const issue = await getIssue(client, 'MRP-1');
      if (!issue?.team) {
        console.log('Skipping: no test issue available');
        return;
      }

      const { resolveTeam } = await import('../../src/lib/resolve.ts');
      const teamId = await resolveTeam(client, issue.team.key);

      const stateId1 = await resolveState(
        client,
        teamId,
        issue.state.name.toLowerCase()
      );
      const stateId2 = await resolveState(
        client,
        teamId,
        issue.state.name.toUpperCase()
      );

      expect(stateId1).toBe(stateId2);
    });
  });

  describe('resolveAssignee', () => {
    beforeEach(() => {
      polly = setupPolly('resolve-assignee');
    });

    it('resolves "none" to null', async () => {
      const result = await resolveAssignee(client, 'none');
      expect(result).toBeNull();
    });

    it('resolves "me" to current user ID', async () => {
      const viewer = await getViewer(client);
      const result = await resolveAssignee(client, 'me');

      expect(result).toBe(viewer.id);
    });
  });

  describe('updateIssue', () => {
    beforeEach(() => {
      polly = setupPolly('update-issue');
    });

    it('updates issue title', async () => {
      const issue = await getIssue(client, 'MRP-1');
      if (!issue) {
        console.log('Skipping: no test issue available');
        return;
      }

      const newTitle = `Test Update ${Date.now()}`;
      const updated = await updateIssue(client, issue.id, {
        title: newTitle,
      });

      expect(updated.title).toBe(newTitle);

      // Restore original title
      await updateIssue(client, issue.id, {
        title: issue.title,
      });
    });

    it('updates issue priority', async () => {
      const issue = await getIssue(client, 'MRP-1');
      if (!issue) {
        console.log('Skipping: no test issue available');
        return;
      }

      const originalPriority = issue.priority;
      const newPriority = originalPriority === 2 ? 3 : 2; // Toggle between high and medium

      const updated = await updateIssue(client, issue.id, {
        priority: newPriority,
      });

      expect(updated.priority).toBe(newPriority);

      // Restore original
      await updateIssue(client, issue.id, {
        priority: originalPriority,
      });
    });

    it('can unassign issue', async () => {
      const issue = await getIssue(client, 'MRP-1');
      if (!issue) {
        console.log('Skipping: no test issue available');
        return;
      }

      const originalAssignee = issue.assignee?.id || null;

      // Unassign
      const updated = await updateIssue(client, issue.id, {
        assigneeId: null,
      });

      expect(updated.assignee).toBeNull();

      // Restore if there was an assignee
      if (originalAssignee) {
        await updateIssue(client, issue.id, {
          assigneeId: originalAssignee,
        });
      }
    });
  });
});
