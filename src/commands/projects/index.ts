import { Command } from 'commander';
import { createListCommand } from './list.ts';
import { createUpdateCommand } from './update.ts';

export function createProjectsCommand(): Command {
  const projects = new Command('projects').description('Project commands');

  projects.addCommand(createListCommand());
  projects.addCommand(createUpdateCommand());

  return projects;
}
