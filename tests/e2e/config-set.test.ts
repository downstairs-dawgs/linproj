/**
 * E2E tests for `config set` command.
 *
 * Tests that config set validates inputs via the Linear API.
 * Requires valid Linear authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { E2ETestContext, runCLI } from './harness.ts';
import { getProjects } from '../../src/lib/api.ts';

describe('config set E2E', () => {
  const ctx = new E2ETestContext();
  let teams: { id: string; key: string; name: string }[];
  let projects: { id: string; name: string }[];

  beforeAll(async () => {
    await ctx.setup();
    ctx.requireApiKey();
    teams = await ctx.getTeams();
    projects = await getProjects(await ctx.getLinearClient());

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
  describe('default-project', () => {
    const workspacePath = () => join(ctx.configDir, 'workspaces', 'test-org-id.json');

    it('validates the project exists and stores its name as Linear spells it', async () => {
      if (projects.length < 1) {
        throw new Error('At least 1 project required for default-project E2E tests');
      }
      const testProject = projects[0]!;
      await ctx.setupV2Config();

      const result = await runCLI(
        ['config', 'set', 'default-project', testProject.name.toUpperCase()],
        { env: ctx.envWithoutApiKey() }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Default project set to: ${testProject.name}`);

      const workspace = JSON.parse(await readFile(workspacePath(), 'utf-8'));
      expect(workspace.defaultProject).toBe(testProject.name);

      const getResult = await runCLI(['config', 'get', 'default-project'], {
        env: ctx.envWithoutApiKey(),
      });
      expect(getResult.exitCode).toBe(0);
      expect(getResult.stdout.trim()).toBe(testProject.name);
    });

    it('fails without writing when the project does not exist', async () => {
      await ctx.setupV2Config();

      const result = await runCLI(
        ['config', 'set', 'default-project', 'Nonexistent Project XYZ'],
        { env: ctx.envWithoutApiKey() }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Project 'Nonexistent Project XYZ' not found");

      const workspace = JSON.parse(await readFile(workspacePath(), 'utf-8'));
      expect(workspace.defaultProject).toBeUndefined();
    });

    it('clears the default with an empty value', async () => {
      await ctx.setupV2Config();
      const workspace = JSON.parse(await readFile(workspacePath(), 'utf-8'));
      workspace.defaultProject = 'Anything';
      await writeFile(workspacePath(), JSON.stringify(workspace));

      const result = await runCLI(['config', 'set', 'default-project', ''], {
        env: ctx.envWithoutApiKey(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Default project cleared');
      const updated = JSON.parse(await readFile(workspacePath(), 'utf-8'));
      expect(updated.defaultProject).toBeUndefined();
    });
  });
});
