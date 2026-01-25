import { Command } from 'commander';
import {
  getCurrentWorkspace,
  writeWorkspace,
  isUsingEnvAuth,
} from '../../lib/config.ts';
import { LinearClient, getTeams, LinearAPIError } from '../../lib/api.ts';

const SUPPORTED_KEYS = ['default-team'] as const;
type SupportedKey = (typeof SUPPORTED_KEYS)[number];

function isSupportedKey(key: string): key is SupportedKey {
  return SUPPORTED_KEYS.includes(key as SupportedKey);
}

export function createSetCommand(): Command {
  return new Command('set')
    .description('Set a config value for the current workspace')
    .argument('<key>', 'Config key to set (supported: default-team)')
    .argument('<value>', 'Value to set')
    .action(async (key: string, value: string) => {
      if (isUsingEnvAuth()) {
        console.error('Error: Config commands are not available when LINEAR_API_KEY is set.');
        console.error('');
        console.error('To use config features, unset the environment variable and run:');
        console.error('  linproj auth login');
        process.exit(1);
      }

      if (!isSupportedKey(key)) {
        console.error(`Error: Unknown config key '${key}'`);
        console.error(`Supported keys: ${SUPPORTED_KEYS.join(', ')}`);
        process.exit(1);
      }

      try {
        const workspace = await getCurrentWorkspace();

        switch (key) {
          case 'default-team': {
            // Validate team exists
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
            break;
          }
        }
      } catch (err) {
        if (err instanceof LinearAPIError) {
          console.error(`Error: ${err.message}`);
        } else {
          console.error(`Error: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    });
}
