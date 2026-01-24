import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, readdirSync } from 'node:fs';
import {
  executeEdit,
  saveRecoveryFile,
  type EditOptions,
  type EditDeps,
  type EditorFn,
} from '../../src/commands/issues/edit.ts';
import type { Issue } from '../../src/lib/api.ts';

// Mock issue for testing
const mockIssue: Issue = {
  id: 'issue-123',
  identifier: 'TEST-456',
  title: 'Test Issue',
  description: 'Original description',
  url: 'https://linear.app/test/issue/TEST-456',
  state: { name: 'Backlog', type: 'backlog' },
  priority: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  team: { key: 'TEST', name: 'Test Team' },
  assignee: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  labels: { nodes: [] },
};

// Mock LinearClient that doesn't make real API calls
const mockClient = {
  query: async () => {
    throw new Error('Mock client should not make API calls');
  },
} as any;

// Helper to clean up recovery files after tests
function cleanupRecoveryFiles(identifier: string) {
  const tmp = tmpdir();
  const files = readdirSync(tmp);
  for (const file of files) {
    if (file.startsWith(`linproj-recovery-${identifier}`)) {
      try {
        unlinkSync(join(tmp, file));
      } catch {}
    }
  }
}

describe('executeEdit with dependency injection', () => {
  afterEach(() => {
    cleanupRecoveryFiles('TEST-456');
  });

  describe('interactive mode', () => {
    it('cancels when editor returns unchanged content', async () => {
      const mockEditor: EditorFn = async (content) => content; // Return unchanged

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
    });

    it('cancels when editor returns empty content', async () => {
      const mockEditor: EditorFn = async () => ''; // Return empty

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
    });

    it('cancels when editor returns whitespace only', async () => {
      const mockEditor: EditorFn = async () => '   \n\n  ';

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
    });

    it('returns error and recovery path on invalid priority', async () => {
      const mockEditor: EditorFn = async (content) => {
        return content.replace(/priority: .*/, 'priority: invalid');
      };

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid priority');
      expect(result.recoveryPath).toBeDefined();
      expect(result.recoveryPath).toContain('linproj-recovery-TEST-456');
    });

    it('returns error and recovery path on invalid YAML', async () => {
      const mockEditor: EditorFn = async () => {
        return '---\ntitle: [broken yaml\n---';
      };

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid YAML');
      expect(result.recoveryPath).toBeDefined();
    });

    it('returns error and recovery path on unknown field', async () => {
      const mockEditor: EditorFn = async () => {
        return '---\ntitle: Valid\nunknownField: Bad\n---';
      };

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown field 'unknownField'");
      expect(result.recoveryPath).toBeDefined();
    });

    it('receives correct initial content from renderFrontmatter', async () => {
      let receivedContent = '';
      const mockEditor: EditorFn = async (content) => {
        receivedContent = content;
        return content; // Cancel by returning unchanged
      };

      await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(receivedContent).toContain('TEST-456');
      expect(receivedContent).toContain('Test Issue');
      expect(receivedContent).toContain('priority: none');
      expect(receivedContent).toContain("state: 'Backlog'");
    });
  });

  describe('stdin mode', () => {
    it('parses valid frontmatter from stdin', async () => {
      const stdinContent = `---
title: 'New Title'
priority: high
---

New description`;

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          readStdin: async () => stdinContent,
          hasStdinData: () => true,
          isTTY: false,
        }
      );

      // Will fail at buildUpdateInput because we have a mock client,
      // but we can verify the error shows it got past parsing
      expect(result.success).toBe(false);
      // The error should be from API resolution, not parsing
      expect(result.error).not.toContain('Invalid YAML');
      expect(result.error).not.toContain('Invalid priority');
    });

    it('returns error and recovery path on invalid stdin content', async () => {
      const stdinContent = `---
priority: badvalue
---`;

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        {},
        {
          readStdin: async () => stdinContent,
          hasStdinData: () => true,
          isTTY: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid priority');
      expect(result.recoveryPath).toBeDefined();
    });
  });

  describe('flag mode', () => {
    it('does not create recovery file on flag-based errors', async () => {
      const issueNoTeam = { ...mockIssue, team: undefined };

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        issueNoTeam,
        { title: 'New title' },
        {
          hasStdinData: () => false,
          isTTY: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Issue has no team');
      expect(result.recoveryPath).toBeUndefined();
    });
  });

  describe('input mode mutual exclusivity', () => {
    it('errors when stdin and flags are both provided', async () => {
      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        { title: 'Flag title' },
        {
          readStdin: async () => '---\ntitle: Stdin\n---',
          hasStdinData: () => true,
          isTTY: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot combine');
    });

    it('errors when recover and flags are both provided', async () => {
      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        { title: 'Flag title', recover: '/tmp/fake.md' },
        {
          hasStdinData: () => false,
          isTTY: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot combine');
    });
  });

  describe('recovery mode', () => {
    it('opens editor with recovery file contents', async () => {
      // First, create a recovery file
      const recoveryContent = `---
title: 'Recovered Title'
priority: high
---

Recovered description`;

      const recoveryPath = await saveRecoveryFile('TEST-456', recoveryContent);

      let editorReceivedContent = '';
      const mockEditor: EditorFn = async (content) => {
        editorReceivedContent = content;
        return ''; // Cancel
      };

      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        { recover: recoveryPath },
        {
          openEditor: mockEditor,
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
      expect(editorReceivedContent).toBe(recoveryContent);

      // Cleanup
      try {
        unlinkSync(recoveryPath);
      } catch {}
    });

    it('errors when recovery file does not exist', async () => {
      const result = await executeEdit(
        mockClient,
        'TEST-456',
        mockIssue,
        { recover: '/tmp/nonexistent-recovery-file.md' },
        {
          hasStdinData: () => false,
          isTTY: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not read recovery file');
    });
  });
});

describe('saveRecoveryFile', () => {
  it('creates file with correct content', async () => {
    const content = '---\ntitle: Test\n---\nDescription';
    const path = await saveRecoveryFile('TEST-123', content);

    expect(path).toContain('linproj-recovery-TEST-123');
    expect(path).toContain(tmpdir());

    const saved = await Bun.file(path).text();
    expect(saved).toBe(content);

    // Cleanup
    unlinkSync(path);
  });

  it('includes timestamp in filename', async () => {
    const before = Math.floor(Date.now() / 1000);
    const path = await saveRecoveryFile('TEST-123', 'content');
    const after = Math.floor(Date.now() / 1000);

    // Extract timestamp from filename
    const match = path.match(/linproj-recovery-TEST-123-(\d+)\.md/);
    expect(match).not.toBeNull();
    expect(match![1]).toBeDefined();
    const timestamp = parseInt(match![1]!, 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);

    // Cleanup
    unlinkSync(path);
  });
});
