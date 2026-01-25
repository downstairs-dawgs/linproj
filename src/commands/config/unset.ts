import { Command } from 'commander';
import {
  getCurrentWorkspace,
  writeWorkspace,
  requireWorkspaceAuth,
} from '../../lib/config.ts';

export function createUnsetCommand(): Command {
  return new Command('unset')
    .description('Remove a config value for the current workspace')
    .argument('<key>', 'Config key to unset (supported: default-team)')
    .action(async (key: string) => {
      try {
        requireWorkspaceAuth();

        if (key !== 'default-team') {
          console.error(`Error: Unknown config key '${key}'`);
          console.error('Supported keys: default-team');
          process.exit(1);
        }

        const workspace = await getCurrentWorkspace();
        delete workspace.defaultTeam;
        await writeWorkspace(workspace);
        console.log('Default team cleared');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
