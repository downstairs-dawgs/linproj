#!/usr/bin/env bun
/**
 * Prototype script for experimenting with comment tree styling.
 * Run with: bun scripts/comment-style-prototype.ts
 */

// ANSI escape codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const UNDERLINE = '\x1b[4m';

// Colors
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightCyan: '\x1b[96m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightGreen: '\x1b[92m',
};

// Tree characters
const tree = {
  vertical: '│',
  branch: '├',
  corner: '└',
  horizontal: '─',
  bullet: '●',
  diamond: '◆',
  smallDiamond: '◇',
  arrow: '▶',
  circle: '○',
  dot: '•',
  verticalBold: '┃',
  branchBold: '┣',
  cornerBold: '┗',
  horizontalBold: '━',
};

// Sample comment data - Linear only supports 2 levels: comments and replies
// IMPORTANT: In Linear, resolving marks the ENTIRE THREAD (top-level + all replies)
// The `resolved` flag only matters on the top-level comment
const sampleComments = [
  {
    author: 'Gabe Vacaliuc',
    time: '2 hours ago',
    resolved: false,
    body: `## Lists Demo

### Unordered Lists
• First item
• Second item with **bold**

### Task Lists
✓ Completed task
○ Still pending`,
    children: [
      {
        author: 'Alice Chen',
        time: '1 hour ago',
        body: 'Great breakdown! The task list feature is really useful.',
        children: [],
      },
      {
        author: 'Gabe Vacaliuc',
        time: '45 min ago',
        body: 'Thanks Alice! Glad you find it helpful.',
        children: [],
      },
    ],
  },
  {
    author: 'Carol Dev',
    time: '1 hour ago',
    resolved: false,
    body: `## Code Example

\`\`\`typescript
const x = 1;
\`\`\`

Check [the docs](https://example.com) for more.`,
    children: [],
  },
  {
    author: 'Dave Ops',
    time: '30 min ago',
    resolved: false,
    body: 'Quick question: does this work with **mermaid** diagrams too?',
    children: [
      {
        author: 'Gabe Vacaliuc',
        time: '15 min ago',
        body: 'Mermaid shows as code blocks with a `[mermaid]` label for now.',
        children: [],
      },
    ],
  },
  {
    // This ENTIRE thread is resolved (Eve's comment + both replies)
    author: 'Eve Security',
    time: '3 hours ago',
    resolved: true,
    body: 'Have we considered the security implications of rendering arbitrary markdown? Could be XSS risk.',
    children: [
      {
        author: 'Gabe Vacaliuc',
        time: '2 hours ago',
        body: 'Good catch! We sanitize all output through the terminal renderer - no HTML is passed through.',
        children: [],
      },
      {
        author: 'Eve Security',
        time: '2 hours ago',
        body: 'Perfect, thanks for confirming. Marking as resolved.',
        children: [],
      },
    ],
  },
  {
    // Another resolved thread - this one with no replies
    author: 'Frank QA',
    time: '4 hours ago',
    resolved: true,
    body: 'Typo on line 42: "recieve" should be "receive".',
    children: [],
  },
];

type Comment = (typeof sampleComments)[0];

function printSeparator(title: string, color: string) {
  console.log('\n' + color + '═'.repeat(60) + RESET);
  console.log(color + BOLD + ` ${title}` + RESET);
  console.log(color + '═'.repeat(60) + RESET + '\n');
}

// ============================================================================
// STYLE A: Clean thread with colored accent bar (2-level)
// ============================================================================
function renderStyleA(comments: Comment[]): void {
  printSeparator('Style A: Accent Bar Thread', colors.cyan);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;
    const hasReplies = comment.children.length > 0;

    // Top-level comment - resolved tag applies to entire thread
    const resolvedTag = comment.resolved ? ` ${colors.green}[resolved]${RESET}` : '';
    console.log(`${colors.cyan}◆${RESET} ${BOLD}${comment.author}${RESET}${resolvedTag}`);
    console.log(`${colors.cyan}│${RESET} ${DIM}${comment.time}${RESET}`);

    for (const line of comment.body.split('\n')) {
      console.log(`${colors.cyan}│${RESET} ${line}`);
    }

    // Replies (no individual resolved tags - resolution is thread-level)
    if (hasReplies) {
      console.log(`${colors.cyan}│${RESET}`);

      comment.children.forEach((reply, replyIdx) => {
        const isLastReply = replyIdx === comment.children.length - 1;
        const connector = isLastReply ? tree.corner : tree.branch;
        const continuer = isLastReply ? ' ' : tree.vertical;

        console.log(`${colors.cyan}${connector}─${colors.gray}◇${RESET} ${BOLD}${reply.author}${RESET}`);
        console.log(`${colors.cyan}${continuer}${RESET}   ${DIM}${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`${colors.cyan}${continuer}${RESET}   ${line}`);
        }

        if (!isLastReply) {
          console.log(`${colors.cyan}${tree.vertical}${RESET}`);
        }
      });
    }

    if (!isLastComment) {
      console.log();
    }
  });
}

// ============================================================================
// STYLE B: Compact with reply arrows (2-level)
// ============================================================================
function renderStyleB(comments: Comment[]): void {
  printSeparator('Style B: Compact Reply Arrows', colors.green);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;

    // Top-level comment - resolved tag applies to entire thread
    const resolvedTag = comment.resolved ? ` ${colors.green}[resolved]${RESET}` : '';
    console.log(`${colors.green}◆${RESET} ${BOLD}${comment.author}${RESET} ${DIM}· ${comment.time}${RESET}${resolvedTag}`);

    for (const line of comment.body.split('\n')) {
      console.log(`${colors.green}│${RESET} ${line}`);
    }

    // Replies (no individual resolved tags)
    if (comment.children.length > 0) {
      console.log(`${colors.green}│${RESET}`);
      const replyText = comment.children.length === 1 ? '1 reply' : `${comment.children.length} replies`;
      console.log(`${colors.green}│${RESET} ${DIM}─── ${replyText} ───${RESET}`);

      comment.children.forEach((reply) => {
        console.log(`${colors.green}│${RESET}`);
        console.log(`${colors.green}│${RESET}  ${colors.gray}↳${RESET} ${BOLD}${reply.author}${RESET} ${DIM}· ${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`${colors.green}│${RESET}    ${line}`);
        }
      });
    }

    console.log();
    if (!isLastComment) {
      console.log();
    }
  });
}

// ============================================================================
// STYLE C: Full tree with connecting lines (2-level)
// ============================================================================
function renderStyleC(comments: Comment[]): void {
  printSeparator('Style C: Full Connected Tree', colors.yellow);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;
    const hasReplies = comment.children.length > 0;

    // Top-level comment - resolved tag applies to entire thread
    const resolvedTag = comment.resolved ? ` ${colors.green}✓${RESET}` : '';
    console.log(`${colors.yellow}●${RESET} ${BOLD}${comment.author}${RESET} ${DIM}· ${comment.time}${RESET}${resolvedTag}`);

    const bodyBar = hasReplies ? `${DIM}│${RESET}` : ' ';
    for (const line of comment.body.split('\n')) {
      console.log(`${bodyBar}  ${line}`);
    }

    // Replies (no individual resolved tags)
    if (hasReplies) {
      console.log(`${DIM}│${RESET}`);

      comment.children.forEach((reply, replyIdx) => {
        const isLastReply = replyIdx === comment.children.length - 1;
        const connector = isLastReply ? `${tree.corner}${tree.horizontal}` : `${tree.branch}${tree.horizontal}`;
        const continuer = isLastReply ? ' ' : `${tree.vertical}`;

        console.log(`${DIM}${connector}${RESET}${colors.yellow}●${RESET} ${BOLD}${reply.author}${RESET} ${DIM}· ${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`${DIM}${continuer}${RESET}   ${line}`);
        }

        if (!isLastReply) {
          console.log(`${DIM}${tree.vertical}${RESET}`);
        }
      });
    }

    if (!isLastComment) {
      console.log();
    }
  });
}



// ============================================================================
// STYLE G: Indented replies with separator (2-level)
// ============================================================================
function renderStyleG(comments: Comment[]): void {
  printSeparator('Style G: Indented with Separator', colors.brightCyan);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;

    // Top-level comment - resolved tag applies to entire thread
    const resolvedTag = comment.resolved ? ` ${colors.green}[resolved]${RESET}` : '';
    console.log(`${colors.brightCyan}●${RESET} ${BOLD}${comment.author}${RESET} ${DIM}· ${comment.time}${RESET}${resolvedTag}`);
    console.log();

    for (const line of comment.body.split('\n')) {
      console.log(`  ${line}`);
    }

    // Replies (no individual resolved tags)
    if (comment.children.length > 0) {
      console.log();
      console.log(`  ${DIM}┌─ Replies ─────────────────────────────────────────${RESET}`);

      comment.children.forEach((reply) => {
        console.log(`  ${DIM}│${RESET}`);
        console.log(`  ${DIM}│${RESET} ${colors.cyan}○${RESET} ${BOLD}${reply.author}${RESET} ${DIM}· ${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`  ${DIM}│${RESET}   ${line}`);
        }
      });

      console.log(`  ${DIM}└${'─'.repeat(52)}${RESET}`);
    }

    if (!isLastComment) {
      console.log();
      console.log();
    }
  });
}

// ============================================================================
// STYLE H: Minimal bullet style (2-level)
// ============================================================================
function renderStyleH(comments: Comment[]): void {
  printSeparator('Style H: Minimal Bullets', colors.yellow);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;

    // Top-level comment - resolved tag applies to entire thread
    const resolvedTag = comment.resolved ? ` ${colors.green}✓${RESET}` : '';
    console.log(`${colors.yellow}●${RESET} ${BOLD}${comment.author}${RESET}${resolvedTag}`);
    console.log(`  ${DIM}${comment.time}${RESET}`);
    console.log();

    for (const line of comment.body.split('\n')) {
      console.log(`  ${line}`);
    }

    // Replies - subdued (no individual resolved tags)
    if (comment.children.length > 0) {
      comment.children.forEach((reply) => {
        console.log();
        console.log(`    ${colors.gray}○${RESET} ${reply.author} ${DIM}· ${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`      ${DIM}${line}${RESET}`);
        }
      });
    }

    if (!isLastComment) {
      console.log();
      console.log(`${DIM}  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─${RESET}`);
      console.log();
    }
  });
}

// ============================================================================
// STYLE I: With collapsed resolved threads (tree style)
// ============================================================================
function renderStyleI(comments: Comment[]): void {
  printSeparator('Style I: Collapsed Resolved (Tree)', colors.cyan);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;
    const hasReplies = comment.children.length > 0;

    // Check if this ENTIRE THREAD is resolved - collapse it all
    if (comment.resolved) {
      const replyCount = comment.children.length;
      const replyText = replyCount > 0 ? ` + ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : '';
      console.log(`${colors.green}✓${RESET} ${DIM}${comment.author} · ${comment.time}${replyText}${RESET}`);

      if (!isLastComment) {
        console.log();
      }
      return;
    }

    // Normal view for unresolved threads
    console.log(`${colors.cyan}◆${RESET} ${BOLD}${comment.author}${RESET}`);
    console.log(`${colors.cyan}│${RESET} ${DIM}${comment.time}${RESET}`);

    for (const line of comment.body.split('\n')) {
      console.log(`${colors.cyan}│${RESET} ${line}`);
    }

    // Replies (all shown since thread is not resolved)
    if (hasReplies) {
      console.log(`${colors.cyan}│${RESET}`);

      comment.children.forEach((reply, replyIdx) => {
        const isLastReply = replyIdx === comment.children.length - 1;
        const connector = isLastReply ? tree.corner : tree.branch;
        const continuer = isLastReply ? ' ' : tree.vertical;

        console.log(`${colors.cyan}${connector}─${colors.gray}◇${RESET} ${BOLD}${reply.author}${RESET}`);
        console.log(`${colors.cyan}${continuer}${RESET}   ${DIM}${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`${colors.cyan}${continuer}${RESET}   ${line}`);
        }

        if (!isLastReply) {
          console.log(`${colors.cyan}${tree.vertical}${RESET}`);
        }
      });
    }

    if (!isLastComment) {
      console.log();
    }
  });
}

// ============================================================================
// STYLE J: With collapsed resolved threads (compact with preview)
// ============================================================================
function renderStyleJ(comments: Comment[]): void {
  printSeparator('Style J: Collapsed Resolved (Compact)', colors.green);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;

    // Check if this ENTIRE THREAD is resolved - collapse it all with preview
    if (comment.resolved) {
      const replyCount = comment.children.length;
      const preview = (comment.body.split('\n')[0] ?? '').slice(0, 40);
      const ellipsis = comment.body.length > 40 || comment.body.includes('\n') ? '...' : '';
      const replyText = replyCount > 0 ? `, ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : '';
      console.log(`${colors.green}✓${RESET} ${DIM}${comment.author}: "${preview}${ellipsis}" (resolved${replyText})${RESET}`);

      if (!isLastComment) {
        console.log();
      }
      return;
    }

    // Normal view for unresolved threads
    console.log(`${colors.green}◆${RESET} ${BOLD}${comment.author}${RESET} ${DIM}· ${comment.time}${RESET}`);

    for (const line of comment.body.split('\n')) {
      console.log(`${colors.green}│${RESET} ${line}`);
    }

    // Replies (all shown since thread is not resolved)
    if (comment.children.length > 0) {
      console.log(`${colors.green}│${RESET}`);

      comment.children.forEach((reply) => {
        console.log(`${colors.green}│${RESET}  ${colors.gray}↳${RESET} ${BOLD}${reply.author}${RESET} ${DIM}· ${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`${colors.green}│${RESET}    ${line}`);
        }
        console.log(`${colors.green}│${RESET}`);
      });
    }

    console.log();
  });
}

// ============================================================================
// STYLE K: Collapsed with box preview
// ============================================================================
function renderStyleK(comments: Comment[]): void {
  printSeparator('Style K: Collapsed with Box', colors.magenta);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;

    // Check if this ENTIRE THREAD is resolved - show in collapsed box
    if (comment.resolved) {
      const firstLine = (comment.body.split('\n')[0] ?? '').slice(0, 45);
      const hasMore = comment.body.length > 45 || comment.body.includes('\n');
      const replyCount = comment.children.length;
      const replyText = replyCount > 0 ? ` + ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : '';

      console.log(`${colors.green}┌─ ✓ resolved ─────────────────────────────────────┐${RESET}`);
      console.log(`${colors.green}│${RESET} ${DIM}${comment.author} · ${comment.time}${replyText}${RESET}`);
      console.log(`${colors.green}│${RESET} ${DIM}${firstLine}${hasMore ? '...' : ''}${RESET}`);
      console.log(`${colors.green}└──────────────────────────────────────────────────┘${RESET}`);

      if (!isLastComment) {
        console.log();
      }
      return;
    }

    // Full view for unresolved threads
    console.log(`${colors.magenta}◆${RESET} ${BOLD}${comment.author}${RESET} ${DIM}· ${comment.time}${RESET}`);
    console.log();

    for (const line of comment.body.split('\n')) {
      console.log(`  ${line}`);
    }

    // Replies (all shown since thread is not resolved)
    if (comment.children.length > 0) {
      console.log();

      comment.children.forEach((reply) => {
        console.log(`  ${colors.gray}└─○${RESET} ${BOLD}${reply.author}${RESET} ${DIM}· ${reply.time}${RESET}`);
        for (const line of reply.body.split('\n')) {
          console.log(`      ${line}`);
        }
      });
    }

    if (!isLastComment) {
      console.log();
      console.log();
    }
  });
}

// ============================================================================
// STYLE X: Combined - Accent Bar + Collapsed with Preview (best of A, I, J)
// ============================================================================
function renderStyleX(comments: Comment[]): void {
  printSeparator('Style X: Accent Bar + Collapsed Preview', colors.cyan);

  comments.forEach((comment, idx) => {
    const isLastComment = idx === comments.length - 1;
    const hasReplies = comment.children.length > 0;

    // COLLAPSED: Resolved threads show as single line with preview
    if (comment.resolved) {
      const replyCount = comment.children.length;
      const replyText = replyCount > 0 ? ` + ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : '';
      const preview = (comment.body.split('\n')[0] ?? '').slice(0, 45);
      const ellipsis = comment.body.length > 45 || comment.body.includes('\n') ? '...' : '';

      console.log(`${colors.green}✓${RESET} ${DIM}${comment.author} · ${comment.time}${replyText}${RESET}`);
      console.log(`  ${DIM}"${preview}${ellipsis}"${RESET}`);

      if (!isLastComment) {
        console.log();
      }
      return;
    }

    // EXPANDED: Normal accent bar style for unresolved threads
    console.log(`${colors.cyan}◆${RESET} ${BOLD}${comment.author}${RESET}`);
    console.log(`${colors.cyan}│${RESET} ${DIM}${comment.time}${RESET}`);

    for (const line of comment.body.split('\n')) {
      console.log(`${colors.cyan}│${RESET} ${line}`);
    }

    // Replies
    if (hasReplies) {
      console.log(`${colors.cyan}│${RESET}`);

      comment.children.forEach((reply, replyIdx) => {
        const isLastReply = replyIdx === comment.children.length - 1;
        const connector = isLastReply ? tree.corner : tree.branch;
        const continuer = isLastReply ? ' ' : tree.vertical;

        console.log(`${colors.cyan}${connector}─${colors.gray}◇${RESET} ${BOLD}${reply.author}${RESET}`);
        console.log(`${colors.cyan}${continuer}${RESET}   ${DIM}${reply.time}${RESET}`);

        for (const line of reply.body.split('\n')) {
          console.log(`${colors.cyan}${continuer}${RESET}   ${line}`);
        }

        if (!isLastReply) {
          console.log(`${colors.cyan}${tree.vertical}${RESET}`);
        }
      });
    }

    if (!isLastComment) {
      console.log();
    }
  });
}

// Run selected variants
console.log('\n' + '═'.repeat(60));
console.log(BOLD + ' Comment Style Prototypes - 2-Level with Collapsed' + RESET);
console.log('═'.repeat(60));

// Just show the new combined style
renderStyleX(sampleComments);

console.log('\n' + '═'.repeat(60));
console.log(' End of prototypes');
console.log('═'.repeat(60) + '\n');
