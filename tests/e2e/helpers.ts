/**
 * Shared helpers for E2E tests.
 */

import { join } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { LinearClient, getTeams, getIssue, deleteIssue } from '../../src/lib/api.ts';

export const CLI_PATH = join(import.meta.dir, '../../src/index.ts');

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCLI(
  args: string[],
  options: { env?: Record<string, string> } = {}
): Promise<RunResult> {
  const env = {
    ...process.env,
    ...options.env,
  };

  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}

/**
 * Context for E2E tests that need isolated config directories.
 */
export class E2ETestContext {
  public tempDir!: string;
  public configDir!: string;
  private originalLinearApiKey: string | undefined;
  private createdIssueIds: string[] = [];
  private client: LinearClient | null = null;

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'linproj-e2e-'));
    this.configDir = join(this.tempDir, 'linproj');
    this.originalLinearApiKey = process.env.LINEAR_API_KEY;
  }

  async teardown(): Promise<void> {
    // Clean up created issues
    if (this.client && this.createdIssueIds.length > 0) {
      for (const identifier of this.createdIssueIds) {
        try {
          const issue = await getIssue(this.client, identifier);
          if (issue) {
            await deleteIssue(this.client, issue.id);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Clean up temp directory
    try {
      await rm(this.tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  get apiKey(): string | undefined {
    return this.originalLinearApiKey;
  }

  requireApiKey(): void {
    if (!this.originalLinearApiKey) {
      throw new Error('LINEAR_API_KEY environment variable is required for this test');
    }
  }

  async getLinearClient(): Promise<LinearClient> {
    this.requireApiKey();
    if (!this.client) {
      this.client = new LinearClient({ type: 'api-key', apiKey: this.originalLinearApiKey! });
    }
    return this.client;
  }

  async getTeams(): Promise<{ id: string; key: string; name: string }[]> {
    const client = await this.getLinearClient();
    return getTeams(client);
  }

  trackCreatedIssue(identifier: string): void {
    this.createdIssueIds.push(identifier);
  }

  envWithoutApiKey(): Record<string, string> {
    return {
      XDG_CONFIG_HOME: this.tempDir,
      LINEAR_API_KEY: '', // Unset to use file config
    };
  }

  /**
   * Create a v2 config with a workspace.
   */
  async setupV2Config(options: {
    workspaceId?: string;
    organizationName?: string;
    urlKey?: string;
    apiKey?: string;
    defaultTeam?: string;
  } = {}): Promise<void> {
    const workspaceId = options.workspaceId || 'test-org-id';
    const apiKey = options.apiKey || this.originalLinearApiKey;

    if (!apiKey) {
      throw new Error('API key required for v2 config setup');
    }

    const workspacesDir = join(this.configDir, 'workspaces');
    await mkdir(workspacesDir, { recursive: true });

    const workspace: Record<string, unknown> = {
      organizationId: workspaceId,
      organizationName: options.organizationName || 'Test Org',
      urlKey: options.urlKey || 'test-org',
      auth: { type: 'api-key', apiKey },
    };

    if (options.defaultTeam) {
      workspace.defaultTeam = options.defaultTeam;
    }

    await writeFile(
      join(workspacesDir, `${workspaceId}.json`),
      JSON.stringify(workspace)
    );

    await writeFile(
      join(this.configDir, 'config.json'),
      JSON.stringify({ version: 2, currentWorkspace: workspaceId })
    );
  }

  /**
   * Create a v1 config.
   */
  async setupV1Config(apiKey?: string): Promise<void> {
    const key = apiKey || this.originalLinearApiKey;

    await mkdir(this.configDir, { recursive: true });

    const config: Record<string, unknown> = {};
    if (key) {
      config.auth = { type: 'api-key', apiKey: key };
    }

    await writeFile(
      join(this.configDir, 'config.json'),
      JSON.stringify(config)
    );
  }
}
