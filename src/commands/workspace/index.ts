import { Command } from 'commander';
import { createListCommand } from './list.ts';
import { createSwitchCommand } from './switch.ts';
import { createCurrentCommand } from './current.ts';

export function createWorkspaceCommand(): Command {
  const workspace = new Command('workspace').description('Workspace management commands');

  workspace.addCommand(createListCommand());
  workspace.addCommand(createSwitchCommand());
  workspace.addCommand(createCurrentCommand());

  return workspace;
}
