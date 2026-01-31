import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import {
  LinearClient,
  getComments,
  buildCommentTree,
  type CommentNode,
} from '../../lib/api.ts';

function formatRelativeTime(isoDate: string): string {
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

function getAuthorDisplay(comment: CommentNode): string {
  if (comment.botActor) {
    return `Bot: ${comment.botActor.name}`;
  }
  return comment.user?.name ?? 'Unknown';
}

function printCommentTree(nodes: CommentNode[], depth = 0): void {
  const indent = '  '.repeat(depth);

  for (const node of nodes) {
    const author = getAuthorDisplay(node);
    const time = formatRelativeTime(node.createdAt);
    const replyTag = depth > 0 ? ' (reply)' : '';
    const resolvedTag = node.resolvingUser ? ' [resolved]' : '';
    const editedTag = node.editedAt ? ' (edited)' : '';

    // Header line
    console.log(`${indent}--- ${author} · ${time}${replyTag}${editedTag}${resolvedTag} ---`);

    // Body - print each line with indentation
    const lines = node.body.split('\n');
    for (const line of lines) {
      console.log(`${indent}${line}`);
    }

    // Print children (replies)
    if (node.children.length > 0) {
      console.log();
      printCommentTree(node.children, depth + 1);
    }

    // Blank line after each top-level comment
    if (depth === 0) {
      console.log();
    }
  }
}

function countComments(nodes: CommentNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    count += countComments(node.children);
  }
  return count;
}

interface CommentsListOptions {
  json?: boolean;
  limit?: string;
  workspace?: string;
}

export function createCommentsCommand(): Command {
  const comments = new Command('comments')
    .description('List and manage comments on an issue')
    .argument('<identifier>', 'Issue identifier (e.g., ENG-123)')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Limit to N top-level comments (includes all replies)')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (identifier: string, options: CommentsListOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);
      const result = await getComments(client, identifier);

      if (!result) {
        console.error(`Error: Issue '${identifier}' not found`);
        process.exit(1);
      }

      const { issue, comments } = result;
      let tree = buildCommentTree(comments);

      // Apply limit to top-level comments only
      if (options.limit) {
        const limit = parseInt(options.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          tree = tree.slice(-limit); // Take last N (most recent)
        }
      }

      const totalCount = countComments(tree);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              issue: {
                identifier: issue.identifier,
                title: issue.title,
                url: issue.url,
              },
              comments: tree,
              totalCount,
            },
            null,
            2
          )
        );
        return;
      }

      // Human-readable output
      console.log();
      console.log(`${issue.identifier}: ${issue.title}`);
      console.log(issue.url);
      console.log();

      if (tree.length === 0) {
        console.log('No comments');
        return;
      }

      console.log(`${totalCount} comment${totalCount === 1 ? '' : 's'}:`);
      console.log();

      printCommentTree(tree);
    });

  return comments;
}
