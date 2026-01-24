import { Command } from 'commander';
import { createListCommand } from './list.ts';
import { createCreateCommand } from './create.ts';
import { createGetCommand } from './get.ts';
import { createSearchCommand } from './search.ts';
import { createEditCommand } from './edit.ts';

export function createIssuesCommand(): Command {
  const issues = new Command('issues').description('Issue commands');

  issues.addCommand(createListCommand());
  issues.addCommand(createCreateCommand());
  issues.addCommand(createGetCommand());
  issues.addCommand(createSearchCommand());
  issues.addCommand(createEditCommand());

  return issues;
}
