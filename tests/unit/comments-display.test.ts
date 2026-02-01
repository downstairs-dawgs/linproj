import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  formatRelativeTime,
  getAuthorDisplay,
  countComments,
  printCommentTree,
} from '../../src/lib/comments-display.ts';
import type { CommentNode } from '../../src/lib/api.ts';

function makeCommentNode(
  overrides: Partial<CommentNode> & { id: string }
): CommentNode {
  return {
    body: 'Test comment body',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-01T10:00:00Z',
    url: 'https://linear.app/test/comment',
    children: [],
    ...overrides,
  };
}

describe('formatRelativeTime', () => {
  it('formats just now', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('5 min ago');
  });

  it('formats hours ago (singular)', () => {
    const date = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 hour ago');
  });

  it('formats hours ago (plural)', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('3 hours ago');
  });

  it('formats days ago (singular)', () => {
    const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 day ago');
  });

  it('formats days ago (plural)', () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('5 days ago');
  });

  it('formats older dates as locale string', () => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(date);
    // Should be a date string, not a relative time
    expect(result).not.toContain('ago');
    expect(result).toMatch(/\d/); // Contains digits
  });
});

describe('getAuthorDisplay', () => {
  it('returns user name when available', () => {
    const node = makeCommentNode({
      id: '1',
      user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
    });
    expect(getAuthorDisplay(node)).toBe('Alice');
  });

  it('returns bot name with prefix when botActor is present', () => {
    const node = makeCommentNode({
      id: '1',
      botActor: { id: 'b1', name: 'LinearBot' },
    });
    expect(getAuthorDisplay(node)).toBe('Bot: LinearBot');
  });

  it('prefers botActor over user', () => {
    const node = makeCommentNode({
      id: '1',
      user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
      botActor: { id: 'b1', name: 'LinearBot' },
    });
    expect(getAuthorDisplay(node)).toBe('Bot: LinearBot');
  });

  it('returns Unknown when no user or bot', () => {
    const node = makeCommentNode({ id: '1' });
    expect(getAuthorDisplay(node)).toBe('Unknown');
  });
});

describe('countComments', () => {
  it('counts single comment', () => {
    const nodes = [makeCommentNode({ id: '1' })];
    expect(countComments(nodes)).toBe(1);
  });

  it('counts multiple top-level comments', () => {
    const nodes = [
      makeCommentNode({ id: '1' }),
      makeCommentNode({ id: '2' }),
      makeCommentNode({ id: '3' }),
    ];
    expect(countComments(nodes)).toBe(3);
  });

  it('counts nested comments', () => {
    const nodes = [
      makeCommentNode({
        id: '1',
        children: [
          makeCommentNode({ id: '2' }),
          makeCommentNode({
            id: '3',
            children: [makeCommentNode({ id: '4' })],
          }),
        ],
      }),
    ];
    expect(countComments(nodes)).toBe(4);
  });

  it('returns 0 for empty array', () => {
    expect(countComments([])).toBe(0);
  });
});

describe('printCommentTree', () => {
  let consoleOutput: string[];
  let originalLog: typeof console.log;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    consoleOutput = [];
    originalLog = console.log;
    originalEnv = { ...process.env };
    // Capture console.log output
    console.log = (...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    };
    // Disable colors for predictable test output
    process.env.NO_COLOR = '1';
  });

  afterEach(() => {
    console.log = originalLog;
    process.env = originalEnv;
  });

  function getOutput(): string {
    return consoleOutput.join('\n');
  }

  describe('unresolved threads (accent bar style)', () => {
    it('renders top-level comment with diamond and accent bar', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Test comment',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('◆'); // Diamond bullet
      expect(output).toContain('Alice'); // Author
      expect(output).toContain('│'); // Accent bar
      expect(output).toContain('Test comment'); // Body
    });

    it('renders timestamp on separate line', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Test',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('2 hours ago');
    });

    it('shows edited tag when comment was edited', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Edited comment',
          editedAt: '2026-02-01T11:00:00Z',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('(edited)');
    });

    it('renders replies with small diamond and tree connectors', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Parent comment',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          children: [
            makeCommentNode({
              id: '2',
              body: 'Reply to parent',
              user: { id: 'u2', name: 'Bob', email: 'bob@example.com' },
            }),
          ],
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('◆'); // Parent diamond
      expect(output).toContain('Alice');
      expect(output).toContain('◇'); // Reply small diamond
      expect(output).toContain('Bob');
      expect(output).toContain('└'); // Corner connector for last reply
      expect(output).toContain('─'); // Horizontal connector
    });

    it('renders multiple replies with branch connectors', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Parent',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          children: [
            makeCommentNode({
              id: '2',
              body: 'First reply',
              user: { id: 'u2', name: 'Bob', email: 'bob@example.com' },
            }),
            makeCommentNode({
              id: '3',
              body: 'Second reply',
              user: { id: 'u3', name: 'Carol', email: 'carol@example.com' },
            }),
          ],
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('├'); // Branch connector for non-last reply
      expect(output).toContain('└'); // Corner connector for last reply
      expect(output).toContain('Bob');
      expect(output).toContain('Carol');
    });
  });

  describe('resolved threads (collapsed style)', () => {
    it('collapses resolved thread to single line', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'This is a resolved comment',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          resolvingUser: { id: 'u2', name: 'Bob' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('✓'); // Checkmark
      expect(output).toContain('Alice');
      // Should NOT have full accent bar structure
      expect(output).not.toContain('◆');
    });

    it('shows reply count in collapsed view', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Resolved with replies',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          resolvingUser: { id: 'u2', name: 'Bob' },
          children: [
            makeCommentNode({ id: '2', body: 'Reply 1' }),
            makeCommentNode({ id: '3', body: 'Reply 2' }),
          ],
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('+ 2 replies');
    });

    it('shows singular reply count', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Resolved with one reply',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          resolvingUser: { id: 'u2', name: 'Bob' },
          children: [makeCommentNode({ id: '2', body: 'Single reply' })],
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('+ 1 reply');
    });

    it('shows preview of comment body', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'This is a short comment',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          resolvingUser: { id: 'u2', name: 'Bob' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('"This is a short comment"');
    });

    it('truncates long preview with ellipsis', () => {
      const longBody =
        'This is a very long comment body that should be truncated in the preview to fit on one line';
      const nodes = [
        makeCommentNode({
          id: '1',
          body: longBody,
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          resolvingUser: { id: 'u2', name: 'Bob' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('...');
      // Should truncate to ~45 chars
      expect(output).not.toContain(longBody);
    });

    it('adds ellipsis for multiline comment even if first line is short', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Short first line\nSecond line',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
          resolvingUser: { id: 'u2', name: 'Bob' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('...');
    });
  });

  describe('mixed resolved and unresolved', () => {
    it('renders resolved and unresolved threads appropriately', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: 'Unresolved thread',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        }),
        makeCommentNode({
          id: '2',
          body: 'Resolved thread',
          user: { id: 'u2', name: 'Bob', email: 'bob@example.com' },
          resolvingUser: { id: 'u3', name: 'Carol' },
        }),
      ];

      printCommentTree(nodes);
      const output = getOutput();

      expect(output).toContain('◆'); // Unresolved uses diamond
      expect(output).toContain('✓'); // Resolved uses checkmark
      expect(output).toContain('Alice');
      expect(output).toContain('Bob');
    });
  });

  describe('raw mode', () => {
    it('prints raw markdown without rendering', () => {
      const nodes = [
        makeCommentNode({
          id: '1',
          body: '**bold** and *italic*',
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        }),
      ];

      printCommentTree(nodes, 0, { raw: true });
      const output = getOutput();

      expect(output).toContain('**bold** and *italic*');
    });
  });
});
