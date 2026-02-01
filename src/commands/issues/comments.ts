import { Command } from 'commander';
import { getAuthContextOrExit } from '../../lib/config.ts';
import {
  LinearClient,
  getComments,
  getIssue,
  buildCommentTree,
  createComment,
  type CommentNode,
  type Comment,
} from '../../lib/api.ts';
import {
  defaultOpenEditor,
  defaultHasStdinData,
  defaultReadStdin,
  stripHtmlComments,
} from './edit.ts';

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

interface CommentsAddOptions {
  replyTo?: string;
  json?: boolean;
  quiet?: boolean;
  workspace?: string;
}

function generateEditorTemplate(identifier: string, title: string): string {
  return `<!-- Comment on ${identifier}: ${title} -->
<!-- Lines starting with <!-- are removed -->
<!-- Save and close to post. Delete all content to cancel. -->

`;
}

async function openCommentEditor(
  identifier: string,
  title: string
): Promise<string> {
  const template = generateEditorTemplate(identifier, title);
  const result = await defaultOpenEditor(template, `comment-${identifier}`);
  return stripHtmlComments(result);
}

function findMostRecentComment(comments: Comment[]): Comment | null {
  if (comments.length === 0) return null;

  return comments.reduce((latest, current) => {
    const latestDate = new Date(latest.createdAt);
    const currentDate = new Date(current.createdAt);
    return currentDate > latestDate ? current : latest;
  });
}

function createAddSubcommand(): Command {
  return new Command('add')
    .description('Add a comment to an issue (default output: comment URL)')
    .argument('<identifier>', 'Issue identifier (e.g., ENG-123)')
    .argument('[body]', 'Comment body (uses stdin or opens editor if not provided)')
    .option('--reply-to <id>', 'Reply to a comment (comment ID or "last" for most recent)')
    .option('--json', 'Output created comment as JSON instead of URL')
    .option('--quiet', 'Suppress all output')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (identifier: string, body: string | undefined, options: CommentsAddOptions) => {
      const ctx = await getAuthContextOrExit(options.workspace);
      const client = new LinearClient(ctx.auth);

      // Fetch the issue to get its ID
      const issue = await getIssue(client, identifier);
      if (!issue) {
        console.error(`Error: Issue '${identifier}' not found`);
        process.exit(1);
      }

      // Determine comment body from: argument > stdin > editor
      let commentBody: string;

      if (body) {
        // Body provided as argument
        commentBody = body;
      } else if (await defaultHasStdinData()) {
        // Read from stdin
        commentBody = await defaultReadStdin();
      } else if (process.stdin.isTTY) {
        // Open editor
        try {
          commentBody = await openCommentEditor(identifier, issue.title);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }
      } else {
        // Non-TTY and no stdin - error
        console.error('Error: Comment body cannot be empty');
        process.exit(1);
      }

      // Validate non-empty
      if (!commentBody.trim()) {
        if (process.stdin.isTTY) {
          // User cancelled by saving empty content
          console.log('Comment cancelled');
          return;
        }
        console.error('Error: Comment body cannot be empty');
        process.exit(1);
      }

      // Resolve --reply-to
      // Note: Linear only supports single-level threading (replies to top-level comments).
      // If the target comment is already a reply, we use its parent to continue the thread.
      let parentId: string | undefined;
      if (options.replyTo) {
        const result = await getComments(client, identifier);
        const comments = result?.comments ?? [];

        if (options.replyTo === 'last') {
          const mostRecent = findMostRecentComment(comments);
          if (!mostRecent) {
            console.error('Error: No comments to reply to');
            process.exit(1);
          }
          // If the most recent comment is a reply, use its parent (continue the thread)
          parentId = mostRecent.parentId ?? mostRecent.id;
        } else {
          // Find the target comment to resolve threading
          const targetComment = comments.find(c => c.id === options.replyTo);
          // If target is a reply, use its parent (continue the thread)
          // If not found, use as-is and let the API validate
          parentId = targetComment?.parentId ?? targetComment?.id ?? options.replyTo;
        }
      }

      // Create the comment
      let comment: Comment;
      try {
        comment = await createComment(client, {
          issueId: issue.id,
          body: commentBody.trim(),
          parentId,
        });
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      // Output
      if (options.quiet) {
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(comment, null, 2));
        return;
      }

      // Default: output URL
      console.log(comment.url);
    });
}

function createListSubcommand(): Command {
  return new Command('list')
    .description('List comments on an issue')
    .argument('<identifier>', 'Issue identifier (e.g., ENG-123)')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Limit to N most recent top-level comments (includes all replies)')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (identifier: string, options: CommentsListOptions) => {
      await executeList(identifier, options);
    });
}

async function executeList(identifier: string, options: CommentsListOptions): Promise<void> {
  const ctx = await getAuthContextOrExit(options.workspace);
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
}

export function createCommentsCommand(): Command {
  const comments = new Command('comments')
    .description('List and manage comments on an issue');

  // Add subcommands - list is the default (when first arg doesn't match a subcommand)
  comments.addCommand(createListSubcommand(), { isDefault: true });
  comments.addCommand(createAddSubcommand());

  return comments;
}
