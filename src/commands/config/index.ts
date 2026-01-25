import { Command } from 'commander';
import { createGetCommand } from './get.ts';
import { createSetCommand } from './set.ts';
import { createUnsetCommand } from './unset.ts';
import { createMigrateCommand } from './migrate.ts';

export function createConfigCommand(): Command {
  const config = new Command('config').description('Configuration management commands');

  config.addCommand(createGetCommand());
  config.addCommand(createSetCommand());
  config.addCommand(createUnsetCommand());
  config.addCommand(createMigrateCommand());

  return config;
}
