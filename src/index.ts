#!/usr/bin/env bun
import { Command } from 'commander';
import packageJson from '../package.json';
import { createAuthCommand } from './commands/auth/index.ts';
import { createIssuesCommand } from './commands/issues/index.ts';
import { createWorkspaceCommand } from './commands/workspace/index.ts';
import { createConfigCommand } from './commands/config/index.ts';
import { createSkillCommand } from './commands/skill/index.ts';
import { createProjectsCommand } from './commands/projects/index.ts';

const program = new Command();

program
  .name('linproj')
  .description('CLI for Linear')
  .version(packageJson.version);

program.addCommand(createAuthCommand());
program.addCommand(createIssuesCommand());
program.addCommand(createWorkspaceCommand());
program.addCommand(createConfigCommand());
program.addCommand(createSkillCommand());
program.addCommand(createProjectsCommand());

program.parse();
