import { Command } from 'commander';
import {
  listWorkspaces,
  setCurrentWorkspace,
  isUsingEnvAuth,
  readGlobalConfig,
  getConfigVersion,
} from '../../lib/config.ts';

export function createSwitchCommand(): Command {
  return new Command('switch')
    .description('Switch to a different workspace')
    .argument('<name>', 'Workspace name (organization name) to switch to')
    .action(async (name: string) => {
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

        // Find workspace by organization name (case-insensitive)
        const workspace = workspaces.find(
          (w) => w.organizationName.toLowerCase() === name.toLowerCase()
        );

        if (!workspace) {
          console.error(`Error: Workspace '${name}' not found.`);
          console.error('');
          if (workspaces.length > 0) {
            console.error('Available workspaces:');
            for (const w of workspaces) {
              console.error(`  ${w.organizationName}`);
            }
          } else {
            console.error('No workspaces configured. Run `linproj auth login` first.');
          }
          process.exit(1);
        }

        await setCurrentWorkspace(workspace.organizationId);
        console.log(`Switched to workspace: ${workspace.organizationName}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
