import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setupPolly, stopPolly } from '../setup.ts';
import { Polly } from '@pollyjs/core';
import {
  LinearClient,
  getProjects,
  createProjectUpdate,
} from '../../src/lib/api.ts';
import { readConfig, type ApiKeyAuth } from '../../src/lib/config.ts';

// Get auth for tests
async function getTestAuth(): Promise<ApiKeyAuth> {
  // In replay mode, use dummy key (auth headers aren't matched)
  if (process.env.POLLY_MODE !== 'record') {
    return { type: 'api-key', apiKey: 'test-key' };
  }

  // In record mode, need real credentials
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    return { type: 'api-key', apiKey: envKey };
  }

  const config = await readConfig();
  if ('auth' in config && config.auth?.type === 'api-key') {
    return config.auth;
  }

  throw new Error(
    'No API key found. Set LINEAR_API_KEY env var or run `linproj auth login`'
  );
}

describe('Projects API', () => {
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

  describe('getProjects', () => {
    beforeEach(() => {
      polly = setupPolly('get-projects');
    });

    it('returns list of projects', async () => {
      const projects = await getProjects(client);

      expect(projects).toBeDefined();
      expect(Array.isArray(projects)).toBe(true);

      // Each project should have id and name
      if (projects.length > 0) {
        const project = projects[0]!;
        expect(project.id).toBeDefined();
        expect(project.name).toBeDefined();
      }
    });
  });

  describe('createProjectUpdate', () => {
    it('creates a project update with body and health', async () => {
      polly = setupPolly('create-project-update');

      // First get a project to create an update for
      const projects = await getProjects(client);
      expect(projects.length).toBeGreaterThan(0);
      const projectId = projects[0]!.id;

      const update = await createProjectUpdate(client, {
        projectId,
        body: '[TEST] Integration test project update',
        health: 'onTrack',
      });

      expect(update).toBeDefined();
      expect(update.id).toBeDefined();
      expect(update.body).toBe('[TEST] Integration test project update');
      expect(update.health).toBe('onTrack');
      expect(update.url).toContain('linear.app');
      expect(update.project).toBeDefined();
      expect(update.project.id).toBe(projectId);
      expect(update.user).toBeDefined();
      expect(update.createdAt).toBeDefined();
    });

    it('creates a project update without health status', async () => {
      polly = setupPolly('create-project-update-no-health');

      // First get a project to create an update for
      const projects = await getProjects(client);
      expect(projects.length).toBeGreaterThan(0);
      const projectId = projects[0]!.id;

      const update = await createProjectUpdate(client, {
        projectId,
        body: '[TEST] Integration test project update without health',
      });

      expect(update).toBeDefined();
      expect(update.id).toBeDefined();
      expect(update.body).toBe('[TEST] Integration test project update without health');
      expect(update.url).toContain('linear.app');
      expect(update.project).toBeDefined();
      expect(update.project.id).toBe(projectId);
    });
  });
});
