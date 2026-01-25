import { Command } from 'commander';
import {
  getCurrentWorkspace,
  writeWorkspace,
  requireWorkspaceAuth,
} from '../../lib/config.ts';
import { LinearClient, getTeams } from '../../lib/api.ts';

export function createSetCommand(): Command {
  return new Command('set')
    .description('Set a config value for the current workspace')
    .argument('<key>', 'Config key to set (supported: default-team)')
    .argument('<value>', 'Value to set')
    .action(async (key: string, value: string) => {
      try {
        requireWorkspaceAuth();

        if (key !== 'default-team') {
          console.error(`Error: Unknown config key '${key}'`);
          console.error('Supported keys: default-team');
          process.exit(1);
        }

        const workspace = await getCurrentWorkspace();
        const client = new LinearClient(workspace.auth);
        const teams = await getTeams(client);
        const team = teams.find((t) => t.key === value);

        if (!team) {
          console.error(`Error: Team '${value}' not found.`);
          console.error('');
          console.error('Available teams:');
          for (const t of teams) {
            console.error(`  ${t.key} - ${t.name}`);
          }
          process.exit(1);
        }

        workspace.defaultTeam = value;
        await writeWorkspace(workspace);
        console.log(`Default team set to: ${value}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
