import { Command } from 'commander';
import { createListCommand } from './list.ts';

export function createTeamsCommand(): Command {
  const teams = new Command('teams').description('Team commands');

  teams.addCommand(createListCommand());

  return teams;
}
