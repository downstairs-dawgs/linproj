import type { CommentNode } from './api.ts';
import { renderMarkdown } from './terminal-markdown.ts';

// ANSI escape codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Colors
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const GREEN = '\x1b[32m';

// Tree characters
const TREE = {
  vertical: '│',
  branch: '├',
  corner: '└',
  horizontal: '─',
  diamond: '◆',
  smallDiamond: '◇',
  checkmark: '✓',
};

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY ?? false;
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

export function getAuthorDisplay(comment: CommentNode): string {
  if (comment.botActor) {
    return `Bot: ${comment.botActor.name}`;
  }
  return comment.user?.name ?? 'Unknown';
}

export function countComments(nodes: CommentNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    count += countComments(node.children);
  }
  return count;
}

export interface PrintCommentOptions {
  raw?: boolean;
}

/**
 * Print a comment tree with accent bar styling.
 *
 * Unresolved threads show full accent bar style:
 * ```
 * ◆ Author Name
 * │ 2 hours ago
 * │ Comment body...
 * │
 * ├─◇ Reply Author
 * │   1 hour ago
 * │   Reply body.
 * │
 * └─◇ Another Reply
 *     30 min ago
 *     Reply.
 * ```
 *
 * Resolved threads collapse to a compact preview:
 * ```
 * ✓ Author Name · 3 hours ago + 2 replies
 *   "First 45 characters of the comment body..."
 * ```
 */
export function printCommentTree(
  nodes: CommentNode[],
  depth = 0,
  options: PrintCommentOptions = {}
): void {
  const useColors = supportsColor();

  // Style helpers
  const style = useColors
    ? (code: string, text: string) => `${code}${text}${RESET}`
    : (_code: string, text: string) => text;

  const cyan = (text: string) => style(CYAN, text);
  const gray = (text: string) => style(GRAY, text);
  const green = (text: string) => style(GREEN, text);
  const bold = (text: string) => style(BOLD, text);
  const dim = (text: string) => style(DIM, text);

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx]!;
    const isLastComment = idx === nodes.length - 1;
    const hasReplies = node.children.length > 0;

    // Check if this ENTIRE THREAD is resolved - collapse it
    if (node.resolvingUser) {
      printCollapsedThread(node, { green, dim, bold });
      if (!isLastComment) {
        console.log();
      }
      continue;
    }

    // EXPANDED: Full accent bar style for unresolved threads
    printExpandedThread(node, isLastComment, hasReplies, options, {
      cyan,
      gray,
      green,
      bold,
      dim,
    });

    if (!isLastComment) {
      console.log();
    }
  }
}

interface StyleHelpers {
  cyan: (text: string) => string;
  gray: (text: string) => string;
  green: (text: string) => string;
  bold: (text: string) => string;
  dim: (text: string) => string;
}

/**
 * Print a collapsed resolved thread.
 */
function printCollapsedThread(
  node: CommentNode,
  styles: Pick<StyleHelpers, 'green' | 'dim' | 'bold'>
): void {
  const { green, dim } = styles;
  const author = getAuthorDisplay(node);
  const time = formatRelativeTime(node.createdAt);
  const replyCount = node.children.length;
  const replyText =
    replyCount > 0 ? ` + ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : '';

  // First line of body as preview
  const preview = node.body.split('\n')[0]!.slice(0, 45);
  const ellipsis = node.body.length > 45 || node.body.includes('\n') ? '...' : '';

  console.log(
    `${green(TREE.checkmark)} ${dim(`${author} · ${time}${replyText}`)}`
  );
  console.log(`  ${dim(`"${preview}${ellipsis}"`)}`);
}

/**
 * Print an expanded unresolved thread with accent bar styling.
 */
function printExpandedThread(
  node: CommentNode,
  isLastComment: boolean,
  hasReplies: boolean,
  options: PrintCommentOptions,
  styles: StyleHelpers
): void {
  const { cyan, gray, green, bold, dim } = styles;
  const author = getAuthorDisplay(node);
  const time = formatRelativeTime(node.createdAt);
  const editedTag = node.editedAt ? dim(' (edited)') : '';

  // Header: ◆ Author Name
  console.log(`${cyan(TREE.diamond)} ${bold(author)}${editedTag}`);
  // Timestamp
  console.log(`${cyan(TREE.vertical)} ${dim(time)}`);

  // Body - render markdown or print raw
  printCommentBody(node.body, cyan(TREE.vertical) + ' ', options);

  // Replies
  if (hasReplies) {
    console.log(`${cyan(TREE.vertical)}`);

    for (let replyIdx = 0; replyIdx < node.children.length; replyIdx++) {
      const reply = node.children[replyIdx]!;
      const isLastReply = replyIdx === node.children.length - 1;
      const connector = isLastReply ? TREE.corner : TREE.branch;
      const continuer = isLastReply ? ' ' : TREE.vertical;

      const replyAuthor = getAuthorDisplay(reply);
      const replyTime = formatRelativeTime(reply.createdAt);
      const replyEditedTag = reply.editedAt ? dim(' (edited)') : '';

      // Reply header: ├─◇ or └─◇
      console.log(
        `${cyan(connector)}${cyan(TREE.horizontal)}${gray(TREE.smallDiamond)} ${bold(replyAuthor)}${replyEditedTag}`
      );
      // Reply timestamp
      console.log(`${cyan(continuer)}   ${dim(replyTime)}`);

      // Reply body with proper prefix
      const replyPrefix = `${cyan(continuer)}   `;
      printCommentBody(reply.body, replyPrefix, options);

      if (!isLastReply) {
        console.log(`${cyan(TREE.vertical)}`);
      }
    }
  }
}

/**
 * Print comment body with a prefix on each line.
 * Handles both raw and markdown-rendered output.
 */
function printCommentBody(
  body: string,
  prefix: string,
  options: PrintCommentOptions
): void {
  if (options.raw) {
    const lines = body.split('\n');
    for (const line of lines) {
      console.log(`${prefix}${line}`);
    }
  } else {
    // Calculate available width accounting for prefix
    // Use a conservative estimate for prefix width (strip ANSI for measurement)
    const prefixWidth = Bun.stringWidth(prefix);
    const availableWidth = Math.max(40, (process.stdout.columns ?? 80) - prefixWidth);
    const rendered = renderMarkdown(body, { width: availableWidth });

    // Split and print with prefix
    for (const line of rendered.trimEnd().split('\n')) {
      console.log(`${prefix}${line}`);
    }
  }
}
