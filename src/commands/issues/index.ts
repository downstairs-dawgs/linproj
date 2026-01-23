import { Command } from 'commander';
import { createListCommand } from './list.ts';
import { createCreateCommand } from './create.ts';

export function createIssuesCommand(): Command {
  const issues = new Command('issues').description('Issue commands');

  issues.addCommand(createListCommand());
  issues.addCommand(createCreateCommand());

  return issues;
}
