import { Command } from 'commander';
import { getAuthContextOrExit } from '../../lib/config.ts';
import {
  LinearClient,
  getComments,
  getIssue,
  buildCommentTree,
  createComment,
  type Comment,
} from '../../lib/api.ts';
import {
  defaultOpenEditor,
  defaultHasStdinData,
  defaultReadStdin,
  stripHtmlComments,
} from './edit.ts';
import { countComments, printCommentTree } from '../../lib/comments-display.ts';

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
