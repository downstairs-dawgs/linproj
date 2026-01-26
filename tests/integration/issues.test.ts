/**
 * Integration tests for issues commands with default team support.
 *
 * These tests verify that issues list/create commands properly use
 * the default team from workspace config.
 * Uses Polly.js for HTTP recording/replay.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Polly } from '@pollyjs/core';
import { setupPolly, stopPolly } from '../setup.ts';
import {
  IntegrationTestContext,
  mockIssues,
  mockTeams,
  mockCreatedIssue,
} from './helpers.ts';
import type { WorkspaceProfile } from '../../src/lib/config.ts';

describe('issues list with default team', () => {
  const ctx = new IntegrationTestContext();
  let polly: Polly;

  const workspaceWithDefault: WorkspaceProfile = {
    organizationId: 'org-with-default',
    organizationName: 'Org With Default Team',
    urlKey: 'org-default',
    auth: { type: 'api-key', apiKey: 'test-api-key' },
    defaultTeam: 'ENG',
  };

  beforeEach(async () => {
    await ctx.setup();
  });

  afterEach(async () => {
    if (polly) {
      await stopPolly(polly);
    }
    await ctx.teardown();
  });

  it('uses default team from workspace when --team not specified', async () => {
    await ctx.setupWorkspace(workspaceWithDefault);

    polly = setupPolly('issues-list-default-team');

    let capturedFilter: Record<string, unknown> | undefined;
    polly.server.post('https://api.linear.app/graphql').intercept((req, res) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('issues(')) {
        capturedFilter = body.variables?.filter;
        res.status(200).json({
          data: {
            issues: { nodes: mockIssues },
          },
        });
      }
    });

    const { createListCommand } = await import('../../src/commands/issues/list.ts');
    const command = createListCommand();
    await command.parseAsync(['node', 'test']);

    expect(capturedFilter).toBeDefined();
    expect(capturedFilter!.team).toEqual({ key: { eq: 'ENG' } });
  });

  it('--team flag overrides default team', async () => {
    await ctx.setupWorkspace(workspaceWithDefault);

    polly = setupPolly('issues-list-override-default-team');

    let capturedFilter: Record<string, unknown> | undefined;
    polly.server.post('https://api.linear.app/graphql').intercept((req, res) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('issues(')) {
        capturedFilter = body.variables?.filter;
        res.status(200).json({
          data: {
            issues: { nodes: [] },
          },
        });
      }
    });

    const { createListCommand } = await import('../../src/commands/issues/list.ts');
    const command = createListCommand();
    await command.parseAsync(['node', 'test', '--team', 'DES']);

    expect(capturedFilter).toBeDefined();
    expect(capturedFilter!.team).toEqual({ key: { eq: 'DES' } });
  });
});

describe('issues create with default team', () => {
  const ctx = new IntegrationTestContext();
  let polly: Polly;

  const workspaceWithDefault: WorkspaceProfile = {
    organizationId: 'org-with-default',
    organizationName: 'Org With Default Team',
    urlKey: 'org-default',
    auth: { type: 'api-key', apiKey: 'test-api-key' },
    defaultTeam: 'ENG',
  };

  const workspace2: WorkspaceProfile = {
    organizationId: 'org-2',
    organizationName: 'Second Org',
    urlKey: 'org-2',
    auth: { type: 'api-key', apiKey: 'different-api-key' },
    defaultTeam: 'DES',
  };

  beforeEach(async () => {
    await ctx.setup();
  });

  afterEach(async () => {
    if (polly) {
      await stopPolly(polly);
    }
    await ctx.teardown();
  });

  it('uses default team from workspace', async () => {
    await ctx.setupWorkspace(workspaceWithDefault);

    polly = setupPolly('issues-create-default-team');

    let capturedTeamId: string | undefined;
    polly.server.post('https://api.linear.app/graphql').intercept((req, res) => {
      const body = JSON.parse(req.body as string);

      if (body.query.includes('teams {')) {
        res.status(200).json({
          data: { teams: { nodes: mockTeams } },
        });
        return;
      }

      if (body.query.includes('issueCreate')) {
        capturedTeamId = body.variables?.input?.teamId;
        res.status(200).json({
          data: {
            issueCreate: {
              success: true,
              issue: mockCreatedIssue,
            },
          },
        });
        return;
      }

      res.status(200).json({ data: {} });
    });

    const { createCreateCommand } = await import('../../src/commands/issues/create.ts');
    const command = createCreateCommand();
    await command.parseAsync(['node', 'test', '--title', 'Test Issue']);

    expect(capturedTeamId).toBe('team-eng');
  });

  it('--workspace flag uses credentials from specified workspace', async () => {
    await ctx.setupWorkspace(workspaceWithDefault);

    // Also write workspace2 (but don't set as current)
    const { writeWorkspace } = await import('../../src/lib/config.ts');
    await writeWorkspace(workspace2);

    polly = setupPolly('issues-create-different-workspace');

    let capturedTeamId: string | undefined;
    polly.server.post('https://api.linear.app/graphql').intercept((req, res) => {
      const body = JSON.parse(req.body as string);

      if (body.query.includes('teams {')) {
        res.status(200).json({
          data: { teams: { nodes: mockTeams } },
        });
        return;
      }

      if (body.query.includes('issueCreate')) {
        capturedTeamId = body.variables?.input?.teamId;
        res.status(200).json({
          data: {
            issueCreate: {
              success: true,
              issue: { ...mockCreatedIssue, identifier: 'DES-123' },
            },
          },
        });
        return;
      }

      res.status(200).json({ data: {} });
    });

    const { createCreateCommand } = await import('../../src/commands/issues/create.ts');
    const command = createCreateCommand();
    await command.parseAsync([
      'node',
      'test',
      '--title',
      'Test Issue',
      '--workspace',
      'Second Org',
    ]);

    expect(capturedTeamId).toBe('team-des');
  });
});
