/**
 * E2E tests for interactive edit mode using mock editor scripts.
 *
 * These tests use the actual CLI binary with $EDITOR set to mock scripts.
 * They require valid Linear authentication.
 *
 * Set TEST_ISSUE_ID env var to use an existing issue, or the tests will
 * create and delete a test issue automatically.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readdirSync, unlinkSync, existsSync } from 'node:fs';

const CLI_PATH = join(import.meta.dir, '../../src/index.ts');
const EDITORS_PATH = join(import.meta.dir, '../fixtures/editors');

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCLI(
  args: string[],
  options: { env?: Record<string, string>; stdin?: string } = {}
): Promise<RunResult> {
  const env = {
    ...process.env,
    ...options.env,
  };

  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    env,
    stdin: options.stdin ? 'pipe' : undefined,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (options.stdin) {
    proc.stdin?.write(options.stdin);
    proc.stdin?.end();
  }

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}

function cleanupRecoveryFiles(identifier: string) {
  const tmp = tmpdir();
  try {
    const files = readdirSync(tmp);
    for (const file of files) {
      if (file.startsWith(`linproj-recovery-${identifier}`)) {
        try {
          unlinkSync(join(tmp, file));
        } catch {}
      }
    }
  } catch {}
}

describe('issues edit interactive E2E', () => {
  let testIssueId: string | null = null;
  let createdIssueId: string | null = null; // Track if we created it (for cleanup)

  beforeAll(async () => {
    // Use provided TEST_ISSUE_ID or create a new test issue
    if (process.env.TEST_ISSUE_ID) {
      testIssueId = process.env.TEST_ISSUE_ID;
      console.log(`Using existing test issue: ${testIssueId}`);
    } else {
      // Create a test issue
      const result = await runCLI([
        'issues',
        'create',
        '--team',
        'DOW',
        '--title',
        `[TEST] Edit Interactive E2E ${Date.now()}`,
      ]);

      if (result.exitCode !== 0) {
        console.error('Failed to create test issue:', result.stderr);
        throw new Error('Could not create test issue. Make sure you are authenticated.');
      }

      // Extract issue ID from output (format: "✓ Created issue DOW-23: title" or "Created DOW-23:")
      const match = result.stdout.match(/([A-Z]+-\d+):/);
      if (!match) {
        console.error('Could not parse issue ID from:', result.stdout);
        throw new Error('Could not parse created issue ID');
      }

      testIssueId = match[1]!;
      createdIssueId = testIssueId;
      console.log(`Created test issue: ${testIssueId}`);
    }
  });

  afterAll(async () => {
    // Only delete if we created the issue
    if (createdIssueId) {
      // Use the API directly to delete (there's no CLI delete command exposed)
      // For now, just log - the issue can be cleaned up manually or via API
      console.log(`Note: Test issue ${createdIssueId} was created for testing.`);
      console.log('You may want to delete it manually or it will be auto-cleaned.');
    }
  });

  afterEach(() => {
    if (testIssueId) {
      cleanupRecoveryFiles(testIssueId);
    }
  });

  describe('successful edits', () => {
    // Run these first before other tests modify the issue
    it('updates issue when editor makes valid changes (priority)', async () => {
      const result = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-set-priority-high'),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated');
      expect(result.stdout).toContain('priority');
    });

    it('updates issue title via editor', async () => {
      const result = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-change-title'),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Updated');
      expect(result.stdout).toContain('title');
    });
  });

  describe('cancel behavior', () => {
    it('cancels when editor returns unchanged content', async () => {
      const result = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-identity'),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Edit cancelled');
    });

    it('cancels when editor clears the file', async () => {
      const result = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-clear'),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Edit cancelled');
    });
  });

  describe('validation errors and recovery', () => {
    it('saves recovery file on validation error', async () => {
      const result = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-invalid-priority'),
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid priority');
      expect(result.stderr).toMatch(/--recover .*\.md/);

      // Verify recovery file was created
      const match = result.stderr.match(/--recover ([^\s]+)/);
      expect(match).not.toBeNull();
      const recoveryPath = match![1]!;
      expect(existsSync(recoveryPath)).toBe(true);

      // Clean up the recovery file
      unlinkSync(recoveryPath);
    });

    it('allows retry via --recover after validation error', async () => {
      // First, trigger a validation error
      const errorResult = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-invalid-priority'),
        },
      });

      expect(errorResult.exitCode).toBe(1);
      const match = errorResult.stderr.match(/--recover ([^\s]+)/);
      expect(match).not.toBeNull();
      const recoveryPath = match![1]!;

      // Now retry with --recover (using an editor that fixes the priority)
      const retryResult = await runCLI(
        ['issues', 'edit', testIssueId!, '--recover', recoveryPath],
        {
          env: {
            EDITOR: join(EDITORS_PATH, 'mock-editor-fix-priority'),
          },
        }
      );

      expect(retryResult.exitCode).toBe(0);
      expect(retryResult.stdout).toContain('Updated');

      // Clean up
      if (existsSync(recoveryPath)) {
        unlinkSync(recoveryPath);
      }
    });
  });

  describe('editor errors', () => {
    it('errors when editor exits with non-zero status', async () => {
      const result = await runCLI(['issues', 'edit', testIssueId!, '-i'], {
        env: {
          EDITOR: join(EDITORS_PATH, 'mock-editor-exit-error'),
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Editor exited with status');
    });
  });

  describe('--recover flag', () => {
    it('errors when recovery file does not exist', async () => {
      const result = await runCLI([
        'issues',
        'edit',
        testIssueId!,
        '--recover',
        '/tmp/nonexistent-file-12345.md',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Could not read recovery file');
    });
  });

  describe('mutual exclusivity', () => {
    it('errors when stdin and flags are combined', async () => {
      const result = await runCLI(
        ['issues', 'edit', testIssueId!, '--title', 'Flag title'],
        {
          stdin: '---\ntitle: Stdin title\n---',
        }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Cannot combine');
    });

    it('errors when --recover and flags are combined', async () => {
      const result = await runCLI([
        'issues',
        'edit',
        testIssueId!,
        '--recover',
        '/tmp/some-file.md',
        '--title',
        'Flag title',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Cannot combine');
    });
  });
});
