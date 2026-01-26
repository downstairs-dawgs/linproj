/**
 * Integration tests for issues commands with default team support.
 *
 * These tests verify that issues list/create commands properly use
 * the default team from workspace config.
 * Uses Polly.js for HTTP recording/replay.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Polly } from '@pollyjs/core';
import { setupPolly, stopPolly } from '../setup.ts';
import {
  writeGlobalConfig,
  writeWorkspace,
  type WorkspaceProfile,
} from '../../src/lib/config.ts';

// Helper class for testing config operations
class TestConfigContext {
  private tempDir!: string;
  private originalXdgConfigHome: string | undefined;
  private originalLinearApiKey: string | undefined;

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-issues-test-'));
    this.originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    this.originalLinearApiKey = process.env.LINEAR_API_KEY;

    process.env.XDG_CONFIG_HOME = this.tempDir;
    // Unset LINEAR_API_KEY to use workspace auth
    delete process.env.LINEAR_API_KEY;
  }

  async teardown(): Promise<void> {
    if (this.originalXdgConfigHome !== undefined) {
      process.env.XDG_CONFIG_HOME = this.originalXdgConfigHome;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }

    if (this.originalLinearApiKey !== undefined) {
      process.env.LINEAR_API_KEY = this.originalLinearApiKey;
    } else {
      delete process.env.LINEAR_API_KEY;
    }

    try {
      await rm(this.tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Mock data
const mockIssues = [
  {
    id: 'issue-1',
    identifier: 'ENG-1',
    title: 'Test Issue 1',
    description: 'Description 1',
    url: 'https://linear.app/test/issue/ENG-1',
    priority: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'ENG', name: 'Engineering' },
  },
  {
    id: 'issue-2',
    identifier: 'ENG-2',
    title: 'Test Issue 2',
    description: 'Description 2',
    url: 'https://linear.app/test/issue/ENG-2',
    priority: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    state: { name: 'Todo', type: 'unstarted' },
    team: { key: 'ENG', name: 'Engineering' },
  },
];

const mockTeams = [
  { id: 'team-eng', key: 'ENG', name: 'Engineering' },
  { id: 'team-des', key: 'DES', name: 'Design' },
];

const mockCreatedIssue = {
  id: 'new-issue-id',
  identifier: 'ENG-123',
  title: 'New Test Issue',
  description: 'Test description',
  priority: 2,
  updatedAt: '2024-01-01T00:00:00Z',
  state: { name: 'Backlog' },
};

describe('issues list with default team', () => {
  const ctx = new TestConfigContext();
  let polly: Polly;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;

  // Workspace with default team
  const workspaceWithDefault: WorkspaceProfile = {
    organizationId: 'org-with-default',
    organizationName: 'Org With Default Team',
    urlKey: 'org-default',
    auth: { type: 'api-key', apiKey: 'test-api-key' },
    defaultTeam: 'ENG',
  };

  // Workspace without default team
  const workspaceNoDefault: WorkspaceProfile = {
    organizationId: 'org-no-default',
    organizationName: 'Org Without Default Team',
    urlKey: 'org-no-default',
    auth: { type: 'api-key', apiKey: 'test-api-key-2' },
  };

  beforeEach(async () => {
    await ctx.setup();

    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    if (polly) {
      await stopPolly(polly);
    }
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    await ctx.teardown();
  });

  it('uses default team from workspace when --team not specified', async () => {
    await writeWorkspace(workspaceWithDefault);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-with-default' });

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

    // Verify the API was called with the default team filter
    expect(capturedFilter).toBeDefined();
    expect(capturedFilter!.team).toEqual({ key: { eq: 'ENG' } });
  });

  it('--team flag overrides default team', async () => {
    await writeWorkspace(workspaceWithDefault);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-with-default' });

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

    // Verify the API was called with the specified team (DES), not the default (ENG)
    expect(capturedFilter).toBeDefined();
    expect(capturedFilter!.team).toEqual({ key: { eq: 'DES' } });
  });
});

describe('issues create with default team', () => {
  const ctx = new TestConfigContext();
  let polly: Polly;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;

  // Workspace with default team
  const workspaceWithDefault: WorkspaceProfile = {
    organizationId: 'org-with-default',
    organizationName: 'Org With Default Team',
    urlKey: 'org-default',
    auth: { type: 'api-key', apiKey: 'test-api-key' },
    defaultTeam: 'ENG',
  };

  // Second workspace for --workspace tests
  const workspace2: WorkspaceProfile = {
    organizationId: 'org-2',
    organizationName: 'Second Org',
    urlKey: 'org-2',
    auth: { type: 'api-key', apiKey: 'different-api-key' },
    defaultTeam: 'DES',
  };

  beforeEach(async () => {
    await ctx.setup();

    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    if (polly) {
      await stopPolly(polly);
    }
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    await ctx.teardown();
  });

  it('uses default team from workspace', async () => {
    await writeWorkspace(workspaceWithDefault);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-with-default' });

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

    // Verify the issue was created with the ENG team (from default)
    expect(capturedTeamId).toBe('team-eng');
  });

  it('--workspace flag uses credentials from specified workspace', async () => {
    await writeWorkspace(workspaceWithDefault);
    await writeWorkspace(workspace2);
    await writeGlobalConfig({ version: 2, currentWorkspace: 'org-with-default' });

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

    // Verify the issue was created with the DES team (from workspace2's defaultTeam)
    expect(capturedTeamId).toBe('team-des');
  });
});
