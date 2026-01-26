/**
 * E2E tests for `config set` command.
 *
 * Tests that config set validates inputs via the Linear API.
 * Requires valid Linear authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { E2ETestContext, runCLI } from './harness.ts';

describe('config set E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();

    if (teams.length < 1) {
      throw new Error('At least 1 team required for config set E2E tests');
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

  describe('default-team', () => {
    it('validates team exists and sets default-team', async () => {
      const testTeam = teams[0]!;
      await ctx.setupV2Config();

      const result = await runCLI(['config', 'set', 'default-team', testTeam.key], {
        env: ctx.envWithoutApiKey(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Default team set to: ${testTeam.key}`);

      // Verify workspace file was updated
      const workspacePath = join(ctx.configDir, 'workspaces', 'test-org-id.json');
      const workspaceContent = await readFile(workspacePath, 'utf-8');
      const workspace = JSON.parse(workspaceContent);
      expect(workspace.defaultTeam).toBe(testTeam.key);
    });

    it('fails with error when team not found', async () => {
      await ctx.setupV2Config();

      const result = await runCLI(['config', 'set', 'default-team', 'NONEXISTENT'], {
        env: ctx.envWithoutApiKey(),
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Team 'NONEXISTENT' not found");
      expect(result.stderr).toContain('Available teams:');

      // Verify workspace was NOT updated with invalid team
      const workspacePath = join(ctx.configDir, 'workspaces', 'test-org-id.json');
      const workspaceContent = await readFile(workspacePath, 'utf-8');
      const workspace = JSON.parse(workspaceContent);
      expect(workspace.defaultTeam).toBeUndefined();
    });

    it('is case-sensitive for team keys', async () => {
      const testTeam = teams[0]!;
      await ctx.setupV2Config();

      // Try lowercase version of team key (should fail if team key is uppercase)
      const lowercaseKey = testTeam.key.toLowerCase();
      if (lowercaseKey !== testTeam.key) {
        const result = await runCLI(['config', 'set', 'default-team', lowercaseKey], {
          env: ctx.envWithoutApiKey(),
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('not found');
      }
    });
  });
});
