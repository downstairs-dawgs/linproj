import { Command } from 'commander';
import { createListCommand } from './list.ts';
import { createCreateCommand } from './create.ts';
import { createGetCommand } from './get.ts';
import { createSearchCommand } from './search.ts';
import { createEditCommand } from './edit.ts';
import { createDoneCommand } from './done.ts';
import { createStartCommand } from './start.ts';
import { createCommentsCommand } from './comments.ts';
import { createCommentCommand } from './comment.ts';

export function createIssuesCommand(): Command {
  const issues = new Command('issues').description('Issue commands');

  issues.addCommand(createListCommand());
  issues.addCommand(createCreateCommand());
  issues.addCommand(createGetCommand());
  issues.addCommand(createSearchCommand());
  issues.addCommand(createEditCommand());
  issues.addCommand(createDoneCommand());
  issues.addCommand(createStartCommand());
  issues.addCommand(createCommentsCommand());
  issues.addCommand(createCommentCommand());

  return issues;
}
