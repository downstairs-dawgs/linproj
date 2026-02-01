import type { CommentNode } from './api.ts';
import { renderMarkdown } from './terminal-markdown.ts';

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

export function printCommentTree(
  nodes: CommentNode[],
  depth = 0,
  options: PrintCommentOptions = {}
): void {
  const indent = '  '.repeat(depth);
  const indentWidth = depth * 2;

  for (const node of nodes) {
    const author = getAuthorDisplay(node);
    const time = formatRelativeTime(node.createdAt);
    const replyTag = depth > 0 ? ' (reply)' : '';
    const resolvedTag = node.resolvingUser ? ' [resolved]' : '';
    const editedTag = node.editedAt ? ' (edited)' : '';

    // Header line
    console.log(`${indent}--- ${author} · ${time}${replyTag}${editedTag}${resolvedTag} ---`);

    // Body - render markdown or print raw
    if (options.raw) {
      const lines = node.body.split('\n');
      for (const line of lines) {
        console.log(`${indent}${line}`);
      }
    } else {
      // Calculate available width accounting for comment indentation
      const availableWidth = (process.stdout.columns ?? 80) - indentWidth;
      const rendered = renderMarkdown(node.body, { width: availableWidth });

      // Split and print with base indentation
      for (const line of rendered.trimEnd().split('\n')) {
        console.log(`${indent}${line}`);
      }
    }

    // Print children (replies)
    if (node.children.length > 0) {
      console.log();
      printCommentTree(node.children, depth + 1, options);
    }

    // Blank line after each top-level comment
    if (depth === 0) {
      console.log();
    }
  }
}
