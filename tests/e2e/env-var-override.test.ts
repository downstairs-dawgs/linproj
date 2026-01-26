/**
 * E2E tests for environment variable override behavior.
 *
 * These tests verify that workspace commands fail with appropriate
 * error messages when LINEAR_API_KEY is set.
 */

import { describe, it, expect } from 'bun:test';
import { runCLI } from './harness.ts';

describe('environment variable override E2E', () => {
  it('workspace list fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['workspace', 'list'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });

  it('workspace switch fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['workspace', 'switch', 'some-workspace'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });

  it('workspace current fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['workspace', 'current'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });

  it('config set fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['config', 'set', 'default-team', 'ENG'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });

  it('config get fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['config', 'get', 'default-team'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });

  it('auth logout fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['auth', 'logout'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });

  it('auth login fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['auth', 'login'], {
      env: { LINEAR_API_KEY: 'some-api-key' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('LINEAR_API_KEY environment variable is set');
  });
});
