import { Command } from 'commander';
import {
  readGlobalConfig,
  listWorkspaces,
  getConfigVersion,
  isUsingEnvAuth,
  type ConfigV2,
} from '../../lib/config.ts';

export function createListCommand(): Command {
  return new Command('list')
    .description('List all configured workspaces')
    .action(async () => {
      if (isUsingEnvAuth()) {
        console.error('Error: Workspace commands are not available when LINEAR_API_KEY is set.');
        console.error('');
        console.error('To use workspaces, unset the environment variable and run:');
        console.error('  linproj auth login');
        process.exit(1);
      }

      try {
        const globalConfig = await readGlobalConfig();
        const version = getConfigVersion(globalConfig);

        if (version === 1) {
          console.error('Error: Config migration required.');
          console.error('');
          console.error('Your configuration uses an older format. Run:');
          console.error('  linproj config migrate');
          process.exit(1);
        }

        const workspaces = await listWorkspaces();

        if (workspaces.length === 0) {
          console.log('No workspaces configured.');
          console.log('');
          console.log('Run `linproj auth login` to set up a workspace.');
          return;
        }

        const config = globalConfig as ConfigV2;

        for (const workspace of workspaces) {
          const isCurrent = workspace.organizationId === config.currentWorkspace;
          const marker = isCurrent ? '*' : ' ';
          const defaultTeamInfo = workspace.defaultTeam
            ? ` [default team: ${workspace.defaultTeam}]`
            : '';

          console.log(`${marker} ${workspace.organizationName}${defaultTeamInfo}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
