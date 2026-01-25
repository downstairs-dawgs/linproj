import { Command } from 'commander';
import { getCurrentWorkspace, requireWorkspaceAuth } from '../../lib/config.ts';

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a config value for the current workspace')
    .argument('<key>', 'Config key to get (supported: default-team)')
    .action(async (key: string) => {
      try {
        requireWorkspaceAuth();

        if (key !== 'default-team') {
          console.error(`Error: Unknown config key '${key}'`);
          console.error('Supported keys: default-team');
          process.exit(1);
        }

        const workspace = await getCurrentWorkspace();
        if (workspace.defaultTeam) {
          console.log(workspace.defaultTeam);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
