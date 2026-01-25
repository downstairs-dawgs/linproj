import { Command } from 'commander';
import {
  getCurrentWorkspace,
  isUsingEnvAuth,
  readGlobalConfig,
  getConfigVersion,
} from '../../lib/config.ts';

export function createCurrentCommand(): Command {
  return new Command('current')
    .description('Show the current workspace')
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

        const workspace = await getCurrentWorkspace();
        console.log(workspace.organizationName);

        if (workspace.defaultTeam) {
          console.log(`Default team: ${workspace.defaultTeam}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
