import { Command } from 'commander';
import { createListCommand } from './list.ts';

export function createIssuesCommand(): Command {
  const issues = new Command('issues').description('Issue commands');

  issues.addCommand(createListCommand());

  return issues;
}
