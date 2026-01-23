import { Command } from 'commander';
import { createLoginCommand } from './login.ts';
import { createLogoutCommand } from './logout.ts';
import { createStatusCommand } from './status.ts';

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Authentication commands');

  auth.addCommand(createLoginCommand());
  auth.addCommand(createLogoutCommand());
  auth.addCommand(createStatusCommand());

  return auth;
}
