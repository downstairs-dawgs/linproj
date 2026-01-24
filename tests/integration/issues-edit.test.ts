import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupPolly, stopPolly } from '../setup.ts';
import { Polly } from '@pollyjs/core';
import {
  LinearClient,
  updateIssue,
  createIssue,
  deleteIssue,
  getWorkflowStates,
  getLabels,
  createLabel,
  deleteLabel,
  getViewer,
  getTeams,
  getIssue,
} from '../../src/lib/api.ts';
import { readConfig, type ApiKeyAuth } from '../../src/lib/config.ts';
import {
  resolveState,
  resolveAssignee,
  resolvePriority,
  resolveTeam,
} from '../../src/lib/resolve.ts';
import { executeEdit } from '../../src/commands/issues/edit.ts';

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
    it('returns workflow states for a team', async () => {
      polly = setupPolly('get-workflow-states');
      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);

      const states = await getWorkflowStates(client, teams[0]!.id);

      expect(Array.isArray(states)).toBe(true);
      expect(states.length).toBeGreaterThan(0);
      expect(states[0]!).toHaveProperty('id');
      expect(states[0]!).toHaveProperty('name');
      expect(states[0]!).toHaveProperty('type');
    });
  });

  describe('getLabels', () => {
    it('returns labels for a team', async () => {
      polly = setupPolly('get-labels');
      const teams = await getTeams(client);
      expect(teams.length).toBeGreaterThan(0);

      const labels = await getLabels(client, teams[0]!.id);

      expect(Array.isArray(labels)).toBe(true);
    });
  });

  describe('resolveState', () => {
    it('resolves state name to ID', async () => {
      polly = setupPolly('resolve-state');
      const teams = await getTeams(client);
      const states = await getWorkflowStates(client, teams[0]!.id);
      expect(states.length).toBeGreaterThan(0);

      const stateId = await resolveState(client, teams[0]!.id, states[0]!.name);

      expect(typeof stateId).toBe('string');
      expect(stateId).toBe(states[0]!.id);
    });

    it('is case-insensitive', async () => {
      polly = setupPolly('resolve-state-case');
      const teams = await getTeams(client);
      const states = await getWorkflowStates(client, teams[0]!.id);
      expect(states.length).toBeGreaterThan(0);

      const stateId1 = await resolveState(
        client,
        teams[0]!.id,
        states[0]!.name.toLowerCase()
      );
      const stateId2 = await resolveState(
        client,
        teams[0]!.id,
        states[0]!.name.toUpperCase()
      );

      expect(stateId1).toBe(stateId2);
    });
  });

  describe('resolveAssignee', () => {
    it('resolves "none" to null', async () => {
      polly = setupPolly('resolve-assignee-none');
      const result = await resolveAssignee(client, 'none');
      expect(result).toBeNull();
    });

    it('resolves "me" to current user ID', async () => {
      polly = setupPolly('resolve-assignee-me');
      const viewer = await getViewer(client);
      const result = await resolveAssignee(client, 'me');

      expect(result).toBe(viewer.id);
    });
  });

  describe('updateIssue', () => {
    it('updates issue title', async () => {
      polly = setupPolly('update-issue-title');
      const teams = await getTeams(client);
      const issue = await createIssue(client, {
        teamId: teams[0]!.id,
        title: 'Test Issue for Title Update',
      });

      try {
        const updated = await updateIssue(client, issue.id, {
          title: 'Updated Title',
        });
        expect(updated.title).toBe('Updated Title');
      } finally {
        await deleteIssue(client, issue.id);
      }
    });

    it('updates issue priority', async () => {
      polly = setupPolly('update-issue-priority');
      const teams = await getTeams(client);
      const issue = await createIssue(client, {
        teamId: teams[0]!.id,
        title: 'Test Issue for Priority Update',
        priority: 0,
      });

      try {
        const updated = await updateIssue(client, issue.id, {
          priority: 2,
        });
        expect(updated.priority).toBe(2);
      } finally {
        await deleteIssue(client, issue.id);
      }
    });

    it('updates issue description', async () => {
      polly = setupPolly('update-issue-description');
      const teams = await getTeams(client);
      const issue = await createIssue(client, {
        teamId: teams[0]!.id,
        title: 'Test Issue for Description Update',
      });

      try {
        const updated = await updateIssue(client, issue.id, {
          description: 'New description content',
        });
        expect(updated.description).toBe('New description content');
      } finally {
        await deleteIssue(client, issue.id);
      }
    });

    it('can unassign issue', async () => {
      polly = setupPolly('update-issue-unassign');
      const teams = await getTeams(client);
      const viewer = await getViewer(client);
      const issue = await createIssue(client, {
        teamId: teams[0]!.id,
        title: 'Test Issue for Unassign',
        assigneeId: viewer.id,
      });

      try {
        const updated = await updateIssue(client, issue.id, {
          assigneeId: null,
        });
        expect(updated.assignee).toBeNull();
      } finally {
        await deleteIssue(client, issue.id);
      }
    });
  });

  describe('team move validation', () => {
    it('errors when moving to team missing a label', async () => {
      polly = setupPolly('team-move-missing-label');

      const teams = await getTeams(client);
      const dowTeam = teams.find((t) => t.key === 'DOW');
      const engTeam = teams.find((t) => t.key === 'ENG');

      if (!dowTeam || !engTeam) {
        console.log('Skipping test: requires both DOW and ENG teams');
        return;
      }

      // Create a test-only label in DOW that won't exist in ENG
      const testLabel = await createLabel(client, {
        teamId: dowTeam.id,
        name: 'test-dow-only',
        color: '#ff0000',
      });

      // Create issue in DOW with the unique label
      const issue = await createIssue(client, {
        teamId: dowTeam.id,
        title: 'Test Issue for Team Move Validation',
      });

      // Add the label to the issue
      await updateIssue(client, issue.id, {
        labelIds: [testLabel.id],
      });

      // Fetch the issue with labels for executeEdit
      const fullIssue = await getIssue(client, issue.identifier);

      try {
        const result = await executeEdit(
          client,
          issue.identifier,
          fullIssue!,
          { team: 'ENG' },
          {
            hasStdinData: () => false,
            isTTY: false,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Cannot move to team 'ENG'");
        expect(result.error).toContain("label 'test-dow-only'");
        expect(result.error).toContain('does not exist in target team');
      } finally {
        await deleteIssue(client, issue.id);
        await deleteLabel(client, testLabel.id);
      }
    });

    it('succeeds moving issue when target team has matching labels', async () => {
      polly = setupPolly('team-move-success');

      const teams = await getTeams(client);
      const dowTeam = teams.find((t) => t.key === 'DOW');
      const engTeam = teams.find((t) => t.key === 'ENG');

      if (!dowTeam || !engTeam) {
        console.log('Skipping test: requires both DOW and ENG teams');
        return;
      }

      // Create issue in DOW without labels (simpler case)
      const issue = await createIssue(client, {
        teamId: dowTeam.id,
        title: 'Test Issue for Team Move Success',
      });

      // Fetch the issue for executeEdit
      const fullIssue = await getIssue(client, issue.identifier);

      try {
        const result = await executeEdit(
          client,
          issue.identifier,
          fullIssue!,
          { team: 'ENG' },
          {
            hasStdinData: () => false,
            isTTY: false,
          }
        );

        expect(result.success).toBe(true);
        expect(result.issue?.team?.key).toBe('ENG');
      } finally {
        await deleteIssue(client, issue.id);
      }
    });
  });
});
