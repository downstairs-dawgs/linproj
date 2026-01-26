#!/usr/bin/env bun
import { Command } from 'commander';
import { createAuthCommand } from './commands/auth/index.ts';
import { createIssuesCommand } from './commands/issues/index.ts';
import { createWorkspaceCommand } from './commands/workspace/index.ts';
import { createConfigCommand } from './commands/config/index.ts';
import { createSkillCommand } from './commands/skill/index.ts';

const program = new Command();

program
  .name('linproj')
  .description('CLI for Linear')
  .version('0.1.0');

program.addCommand(createAuthCommand());
program.addCommand(createIssuesCommand());
program.addCommand(createWorkspaceCommand());
program.addCommand(createConfigCommand());
program.addCommand(createSkillCommand());

program.parse();
