import { Command } from 'commander';
import { readConfig, clearAuth } from '../../lib/config.ts';

export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Remove stored credentials')
    .action(async () => {
      const config = await readConfig();

      if (!config.auth) {
        console.log('Not currently authenticated');
        return;
      }

      await clearAuth();
      console.log('✓ Logged out');
    });
}
