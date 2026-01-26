/**
 * Shared helpers for integration tests.
 */

import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spyOn } from 'bun:test';
import {
  writeGlobalConfig,
  writeWorkspace,
  type WorkspaceProfile,
} from '../../src/lib/config.ts';

/**
 * Context for integration tests that need isolated config directories.
 */
export class IntegrationTestContext {
  private tempDir!: string;
  private originalXdgConfigHome: string | undefined;
  private originalLinearApiKey: string | undefined;
  public consoleLogSpy!: ReturnType<typeof spyOn>;
  public consoleErrorSpy!: ReturnType<typeof spyOn>;
  public processExitSpy!: ReturnType<typeof spyOn>;

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-integration-'));
    this.originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    this.originalLinearApiKey = process.env.LINEAR_API_KEY;

    process.env.XDG_CONFIG_HOME = this.tempDir;
    delete process.env.LINEAR_API_KEY;

    this.consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    this.consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    this.processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  }

  async teardown(): Promise<void> {
    this.consoleLogSpy?.mockRestore();
    this.consoleErrorSpy?.mockRestore();
    this.processExitSpy?.mockRestore();

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

  /**
   * Create a workspace and set it as current.
   */
  async setupWorkspace(workspace: WorkspaceProfile): Promise<void> {
    await writeWorkspace(workspace);
    await writeGlobalConfig({ version: 2, currentWorkspace: workspace.organizationId });
  }
}

// Common mock data
export const mockViewer = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
};

export const mockTeams = [
  { id: 'team-eng', key: 'ENG', name: 'Engineering' },
  { id: 'team-des', key: 'DES', name: 'Design' },
];

export const mockIssues = [
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

export const mockCreatedIssue = {
  id: 'new-issue-id',
  identifier: 'ENG-123',
  title: 'New Test Issue',
  description: 'Test description',
  priority: 2,
  updatedAt: '2024-01-01T00:00:00Z',
  state: { name: 'Backlog' },
};
