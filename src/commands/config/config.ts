import { Command } from 'commander';
import {
  getCurrentWorkspace,
  writeWorkspace,
  readGlobalConfig,
  getConfigVersion,
} from '../../lib/config.ts';
import { LinearClient, getTeams } from '../../lib/api.ts';

function requireV2Config(): void {
  // Note: This is a sync check, full config version check happens in action
  if (process.env.LINEAR_API_KEY) {
    console.error('Error: LINEAR_API_KEY environment variable is set.');
    console.error('Unset it to manage workspace configuration.');
    process.exit(1);
  }
}

async function ensureV2Config(): Promise<void> {
  const globalConfig = await readGlobalConfig();
  const version = getConfigVersion(globalConfig);

  if (version === 1) {
    console.error('Error: Config migration required.');
    console.error('Run `linproj config migrate` first.');
    process.exit(1);
  }
}

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a config value for the current workspace')
    .argument('<key>', 'Config key to get (supported: default-team)')
    .action(async (key: string) => {
      requireV2Config();
      await ensureV2Config();

      if (key !== 'default-team') {
        console.error(`Error: Unknown config key '${key}'`);
        console.error('Supported keys: default-team');
        process.exit(1);
      }

      try {
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

export function createSetCommand(): Command {
  return new Command('set')
    .description('Set a config value for the current workspace (use empty value to clear)')
    .argument('<key>', 'Config key to set (supported: default-team)')
    .argument('<value>', 'Value to set (use "" to clear)')
    .action(async (key: string, value: string) => {
      requireV2Config();
      await ensureV2Config();

      if (key !== 'default-team') {
        console.error(`Error: Unknown config key '${key}'`);
        console.error('Supported keys: default-team');
        process.exit(1);
      }

      try {
        const workspace = await getCurrentWorkspace();

        // Empty value clears the setting
        if (value === '') {
          delete workspace.defaultTeam;
          await writeWorkspace(workspace);
          console.log('Default team cleared');
          return;
        }

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
