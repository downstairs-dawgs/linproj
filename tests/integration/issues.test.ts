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
import { IntegrationTestContext } from './helpers.ts';
import { writeWorkspace, type WorkspaceProfile } from '../../src/lib/config.ts';
import { readConfig, type ApiKeyAuth } from '../../src/lib/config.ts';
import { LinearClient, getIssue, deleteIssue } from '../../src/lib/api.ts';

/**
 * Extract issue identifier from console output.
 * The create command logs: "✓ Created issue ENG-123: Title"
 */
function extractIssueIdentifier(consoleLogSpy: { mock: { calls: unknown[][] } }): string | null {
  for (const call of consoleLogSpy.mock.calls) {
    const msg = String(call[0]);
    const match = msg.match(/Created issue ([A-Z]+-\d+):/);
    if (match) {
      return match[1]!;
    }
  }
  return null;
}

/**
 * Delete an issue by identifier (e.g., "ENG-123").
 */
async function deleteIssueByIdentifier(client: LinearClient, identifier: string): Promise<void> {
  const issue = await getIssue(client, identifier);
  if (issue) {
    await deleteIssue(client, issue.id);
  }
}

// Get auth for tests - must be called before IntegrationTestContext.setup()
// because setup() deletes LINEAR_API_KEY from env
let cachedAuth: ApiKeyAuth | null = null;

async function getTestAuth(): Promise<ApiKeyAuth> {
  if (cachedAuth) {
    return cachedAuth;
  }

  // In replay mode, use dummy key (auth headers aren't matched)
  if (process.env.POLLY_MODE !== 'record') {
    cachedAuth = { type: 'api-key', apiKey: 'test-key' };
    return cachedAuth;
  }

  // In record mode, need real credentials
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    cachedAuth = { type: 'api-key', apiKey: envKey };
    return cachedAuth;
  }

  const config = await readConfig();
  if ('auth' in config && config.auth?.type === 'api-key') {
    cachedAuth = config.auth;
    return cachedAuth;
  }

  throw new Error(
    'No API key found. Set LINEAR_API_KEY env var or run `linproj auth login`'
  );
}

// Pre-fetch auth before any tests run (before setup() deletes env vars)
const authPromise = getTestAuth();

describe('issues list with default team', () => {
  const ctx = new IntegrationTestContext();
  let polly: Polly;

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
    const auth = await authPromise;
    const workspaceWithDefault: WorkspaceProfile = {
      organizationId: 'org-with-default',
      organizationName: 'Org With Default Team',
      urlKey: 'org-default',
      auth,
      defaultTeam: 'ENG',
    };
    await ctx.setupWorkspace(workspaceWithDefault);

    polly = setupPolly('issues-list-with-default-team');

    // Capture the request to verify the filter
    let capturedFilter: Record<string, unknown> | undefined;
    polly.server.post('https://api.linear.app/graphql').on('request', (req) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('issues(')) {
        capturedFilter = body.variables?.filter;
      }
    });

    const { createListCommand } = await import('../../src/commands/issues/list.ts');
    const command = createListCommand();
    await command.parseAsync(['node', 'test']);

    expect(capturedFilter).toBeDefined();
    expect(capturedFilter!.team).toEqual({ key: { eq: 'ENG' } });
  });

  it('--team flag overrides default team', async () => {
    const auth = await authPromise;
    const workspaceWithDefault: WorkspaceProfile = {
      organizationId: 'org-with-default',
      organizationName: 'Org With Default Team',
      urlKey: 'org-default',
      auth,
      defaultTeam: 'ENG',
    };
    await ctx.setupWorkspace(workspaceWithDefault);

    polly = setupPolly('issues-list-override-default-team');

    let capturedFilter: Record<string, unknown> | undefined;
    polly.server.post('https://api.linear.app/graphql').on('request', (req) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('issues(')) {
        capturedFilter = body.variables?.filter;
      }
    });

    const { createListCommand } = await import('../../src/commands/issues/list.ts');
    const command = createListCommand();
    await command.parseAsync(['node', 'test', '--team', 'DOW']);

    expect(capturedFilter).toBeDefined();
    expect(capturedFilter!.team).toEqual({ key: { eq: 'DOW' } });
  });
});

describe('issues create with default team', () => {
  const ctx = new IntegrationTestContext();
  let polly: Polly;

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
    const auth = await authPromise;
    const workspaceWithDefault: WorkspaceProfile = {
      organizationId: 'org-with-default',
      organizationName: 'Org With Default Team',
      urlKey: 'org-default',
      auth,
      defaultTeam: 'ENG',
    };
    await ctx.setupWorkspace(workspaceWithDefault);

    polly = setupPolly('issues-create-with-default-team');

    let capturedTeamId: string | undefined;
    polly.server.post('https://api.linear.app/graphql').on('request', (req) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('issueCreate')) {
        capturedTeamId = body.variables?.input?.teamId;
      }
    });

    const { createCreateCommand } = await import('../../src/commands/issues/create.ts');
    const command = createCreateCommand();
    try {
      await command.parseAsync(['node', 'test', '--title', 'Test Issue']);

      // ENG team ID from recordings
      expect(capturedTeamId).toBe('02b40065-0a2f-48e1-96e7-a1bc0d41f71f');
    } finally {
      // Cleanup: delete created issue
      const identifier = extractIssueIdentifier(ctx.consoleLogSpy);
      if (identifier) {
        const client = new LinearClient(auth);
        await deleteIssueByIdentifier(client, identifier);
      }
    }
  });

  it('--workspace flag uses credentials from specified workspace', async () => {
    const auth = await authPromise;
    const workspaceWithDefault: WorkspaceProfile = {
      organizationId: 'org-with-default',
      organizationName: 'Org With Default Team',
      urlKey: 'org-default',
      auth,
      defaultTeam: 'ENG',
    };
    await ctx.setupWorkspace(workspaceWithDefault);

    // Also write workspace2 (but don't set as current)
    const workspace2: WorkspaceProfile = {
      organizationId: 'org-2',
      organizationName: 'Second Org',
      urlKey: 'org-2',
      auth, // Same auth in tests - uses same recording
      defaultTeam: 'DOW',
    };
    await writeWorkspace(workspace2);

    polly = setupPolly('issues-create-workspace-flag');

    let capturedTeamId: string | undefined;
    polly.server.post('https://api.linear.app/graphql').on('request', (req) => {
      const body = JSON.parse(req.body as string);
      if (body.query.includes('issueCreate')) {
        capturedTeamId = body.variables?.input?.teamId;
      }
    });

    const { createCreateCommand } = await import('../../src/commands/issues/create.ts');
    const command = createCreateCommand();
    try {
      await command.parseAsync([
        'node',
        'test',
        '--title',
        'Test Issue',
        '--workspace',
        'Second Org',
      ]);

      // DOW team ID from recordings
      expect(capturedTeamId).toBe('77715990-3013-4620-a72d-e615e6d7eeb9');
    } finally {
      // Cleanup: delete created issue
      const identifier = extractIssueIdentifier(ctx.consoleLogSpy);
      if (identifier) {
        const client = new LinearClient(auth);
        await deleteIssueByIdentifier(client, identifier);
      }
    }
  });
});
