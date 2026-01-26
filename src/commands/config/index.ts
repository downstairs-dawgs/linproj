import { Command } from 'commander';
import { createGetCommand, createSetCommand } from './config.ts';
import { createMigrateCommand } from './migrate.ts';

export function createConfigCommand(): Command {
  const config = new Command('config').description('Configuration management commands');

  config.addCommand(createGetCommand());
  config.addCommand(createSetCommand());
  config.addCommand(createMigrateCommand());

  return config;
}
