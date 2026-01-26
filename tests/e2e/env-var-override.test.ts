/**
 * E2E tests for environment variable override behavior.
 *
 * These tests verify that workspace commands fail with appropriate
 * error messages when LINEAR_API_KEY is set.
 */

import { describe, it, expect } from 'bun:test';
import { join } from 'node:path';

const CLI_PATH = join(import.meta.dir, '../../src/index.ts');

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCLI(
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

describe('environment variable override E2E', () => {
  it('workspace list fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['workspace', 'list'], {
      env: {
        LINEAR_API_KEY: 'some-api-key',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not available when LINEAR_API_KEY environment variable is set');
    expect(result.stderr).toContain('Unset the variable and run');
    expect(result.stderr).toContain('linproj auth login');
  });

  it('workspace switch fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['workspace', 'switch', 'some-workspace'], {
      env: {
        LINEAR_API_KEY: 'some-api-key',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not available when LINEAR_API_KEY environment variable is set');
    expect(result.stderr).toContain('Unset the variable and run');
    expect(result.stderr).toContain('linproj auth login');
  });

  it('workspace current fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['workspace', 'current'], {
      env: {
        LINEAR_API_KEY: 'some-api-key',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not available when LINEAR_API_KEY environment variable is set');
  });

  it('config set fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['config', 'set', 'default-team', 'ENG'], {
      env: {
        LINEAR_API_KEY: 'some-api-key',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not available when LINEAR_API_KEY environment variable is set');
  });

  it('config get fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['config', 'get', 'default-team'], {
      env: {
        LINEAR_API_KEY: 'some-api-key',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not available when LINEAR_API_KEY environment variable is set');
  });

  it('auth logout fails when LINEAR_API_KEY is set', async () => {
    const result = await runCLI(['auth', 'logout'], {
      env: {
        LINEAR_API_KEY: 'some-api-key',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not available when LINEAR_API_KEY environment variable is set');
  });
});
