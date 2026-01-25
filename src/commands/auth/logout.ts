import { Command } from 'commander';
import {
  readGlobalConfig,
  writeGlobalConfig,
  getConfigVersion,
  listWorkspaces,
  deleteWorkspace,
  isUsingEnvAuth,
  type ConfigV1,
  type ConfigV2,
} from '../../lib/config.ts';

interface LogoutOptions {
  all?: boolean;
  workspace?: string;
}

export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Remove stored credentials')
    .option('--all', 'Remove all workspaces')
    .option('-w, --workspace <name>', 'Remove a specific workspace by name')
    .action(async (options: LogoutOptions) => {
      if (isUsingEnvAuth()) {
        console.error('Error: Cannot logout while LINEAR_API_KEY environment variable is set.');
        console.error('');
        console.error('Unset the environment variable to manage workspace authentication.');
        process.exit(1);
      }

      const globalConfig = await readGlobalConfig();
      const version = getConfigVersion(globalConfig);

      // Handle v1 config
      if (version === 1) {
        const v1Config = globalConfig as ConfigV1;
        if (!v1Config.auth) {
          console.log('Not currently authenticated');
          return;
        }
        await writeGlobalConfig({});
        console.log('Logged out');
        return;
      }

      const config = globalConfig as ConfigV2;
      const workspaces = await listWorkspaces();

      if (workspaces.length === 0) {
        console.log('Not currently authenticated');
        return;
      }

      // Handle --all flag
      if (options.all) {
        for (const workspace of workspaces) {
          await deleteWorkspace(workspace.organizationId);
        }
        await writeGlobalConfig({ version: 2 });
        console.log(`Logged out from all ${workspaces.length} workspace(s)`);
        return;
      }

      // Handle --workspace flag
      if (options.workspace) {
        const workspace = workspaces.find(
          (w) => w.organizationName.toLowerCase() === options.workspace!.toLowerCase()
        );

        if (!workspace) {
          console.error(`Error: Workspace '${options.workspace}' not found.`);
          console.error('');
          console.error('Available workspaces:');
          for (const w of workspaces) {
            console.error(`  ${w.organizationName}`);
          }
          process.exit(1);
        }

        await deleteWorkspace(workspace.organizationId);

        // If this was the current workspace, switch to another or clear
        if (config.currentWorkspace === workspace.organizationId) {
          const remaining = workspaces.filter((w) => w.organizationId !== workspace.organizationId);
          if (remaining.length > 0) {
            await writeGlobalConfig({
              version: 2,
              currentWorkspace: remaining[0]!.organizationId,
            });
            console.log(`Logged out from: ${workspace.organizationName}`);
            console.log(`Switched to: ${remaining[0]!.organizationName}`);
          } else {
            await writeGlobalConfig({ version: 2 });
            console.log(`Logged out from: ${workspace.organizationName}`);
          }
        } else {
          console.log(`Logged out from: ${workspace.organizationName}`);
        }
        return;
      }

      // Default: remove current workspace
      if (!config.currentWorkspace) {
        console.log('No current workspace set');
        return;
      }

      const currentWorkspace = workspaces.find((w) => w.organizationId === config.currentWorkspace);
      if (!currentWorkspace) {
        console.log('Current workspace not found');
        return;
      }

      await deleteWorkspace(currentWorkspace.organizationId);

      // Switch to another workspace if available
      const remaining = workspaces.filter((w) => w.organizationId !== currentWorkspace.organizationId);
      if (remaining.length > 0) {
        await writeGlobalConfig({
          version: 2,
          currentWorkspace: remaining[0]!.organizationId,
        });
        console.log(`Logged out from: ${currentWorkspace.organizationName}`);
        console.log(`Switched to: ${remaining[0]!.organizationName}`);
      } else {
        await writeGlobalConfig({ version: 2 });
        console.log(`Logged out from: ${currentWorkspace.organizationName}`);
      }
    });
}
