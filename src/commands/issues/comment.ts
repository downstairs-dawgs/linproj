import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import {
  LinearClient,
  getComment,
  updateComment,
  deleteComment,
  getViewer,
  type Comment,
} from '../../lib/api.ts';
import {
  defaultOpenEditor,
  defaultHasStdinData,
  defaultReadStdin,
} from './edit.ts';
import * as readline from 'node:readline';

interface CommentEditOptions {
  json?: boolean;
  quiet?: boolean;
  workspace?: string;
}

interface CommentDeleteOptions {
  yes?: boolean;
  json?: boolean;
  quiet?: boolean;
  workspace?: string;
}

function generateEditTemplate(commentId: string, currentBody: string): string {
  return `<!-- Editing comment ${commentId} -->
<!-- Lines starting with <!-- are removed -->
<!-- Save and close to update. Delete all content to cancel. -->

${currentBody}`;
}

function stripHtmlComments(content: string): string {
  return content
    .split('\n')
    .filter(line => !line.trimStart().startsWith('<!--'))
    .join('\n')
    .trim();
}

async function openEditEditor(
  commentId: string,
  currentBody: string
): Promise<string> {
  const template = generateEditTemplate(commentId, currentBody);
  const result = await defaultOpenEditor(template, `comment-edit-${commentId.slice(0, 8)}`);
  return stripHtmlComments(result);
}

async function confirmDelete(): Promise<boolean> {
  // Non-interactive mode
  if (!process.stdin.isTTY) {
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Delete this comment? [y/N] ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function validateOwnership(
  client: LinearClient,
  comment: Comment
): Promise<{ isOwner: boolean; viewerId: string }> {
  // TODO: cache viewer in workspace profile
  const viewer = await getViewer(client);
  const isOwner = comment.user?.id === viewer.id;
  return { isOwner, viewerId: viewer.id };
}

function createEditSubcommand(): Command {
  return new Command('edit')
    .description('Edit a comment')
    .argument('<comment-id>', 'Comment ID (UUID)')
    .argument('[body]', 'New comment body (uses stdin or opens editor if not provided)')
    .option('--json', 'Output updated comment as JSON')
    .option('--quiet', 'Suppress output')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (commentId: string, body: string | undefined, options: CommentEditOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);

      // Fetch the comment
      const comment = await getComment(client, commentId);
      if (!comment) {
        console.error('Error: Comment not found');
        process.exit(1);
      }

      // Validate ownership
      const { isOwner } = await validateOwnership(client, comment);
      if (!isOwner) {
        console.error('Error: You can only edit your own comments');
        process.exit(1);
      }

      // Determine new body from: argument > stdin > editor
      let newBody: string;

      if (body) {
        newBody = body;
      } else if (await defaultHasStdinData()) {
        newBody = await defaultReadStdin();
      } else if (process.stdin.isTTY) {
        try {
          newBody = await openEditEditor(commentId, comment.body);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }
      } else {
        console.error('Error: New comment body required');
        process.exit(1);
      }

      // Validate non-empty
      if (!newBody.trim()) {
        if (process.stdin.isTTY) {
          console.log('Edit cancelled');
          return;
        }
        console.error('Error: Comment body cannot be empty');
        process.exit(1);
      }

      // Check if content actually changed
      if (newBody.trim() === comment.body.trim()) {
        if (!options.quiet) {
          console.log('No changes to apply');
        }
        return;
      }

      // Update the comment
      let updatedComment: Comment;
      try {
        updatedComment = await updateComment(client, commentId, {
          body: newBody.trim(),
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
        console.log(JSON.stringify(updatedComment, null, 2));
        return;
      }

      console.log(`Updated comment: ${updatedComment.url}`);
    });
}

function createDeleteSubcommand(): Command {
  return new Command('delete')
    .description('Delete a comment')
    .argument('<comment-id>', 'Comment ID (UUID)')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'Output result as JSON')
    .option('--quiet', 'Suppress output')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (commentId: string, options: CommentDeleteOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);

      // Fetch the comment
      const comment = await getComment(client, commentId);
      if (!comment) {
        console.error('Error: Comment not found');
        process.exit(1);
      }

      // Validate ownership
      const { isOwner } = await validateOwnership(client, comment);
      if (!isOwner) {
        console.error('Error: You can only delete your own comments');
        process.exit(1);
      }

      // Confirm deletion unless --yes
      if (!options.yes) {
        console.log(`Comment on ${comment.issueIdentifier}:`);
        console.log();
        // Show first few lines of the comment
        const previewLines = comment.body.split('\n').slice(0, 3);
        for (const line of previewLines) {
          console.log(`  ${line}`);
        }
        if (comment.body.split('\n').length > 3) {
          console.log('  ...');
        }
        console.log();

        const confirmed = await confirmDelete();
        if (!confirmed) {
          console.log('Delete cancelled');
          return;
        }
      }

      // Delete the comment
      let success: boolean;
      try {
        success = await deleteComment(client, commentId);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      if (!success) {
        console.error('Error: Failed to delete comment');
        process.exit(1);
      }

      // Output
      if (options.quiet) {
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ success: true, deleted: commentId }, null, 2));
        return;
      }

      console.log('Comment deleted');
    });
}

export function createCommentCommand(): Command {
  const comment = new Command('comment')
    .description('Manage a specific comment (edit, delete)');

  comment.addCommand(createEditSubcommand());
  comment.addCommand(createDeleteSubcommand());

  return comment;
}
