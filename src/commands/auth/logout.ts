import { Command } from 'commander';
import {
  writeGlobalConfig,
  ensureV2Config,
  listWorkspaces,
  deleteWorkspace,
  findWorkspaceByName,
  type ConfigV2,
} from '../../lib/config.ts';

interface LogoutOptions {
  all?: boolean;
  workspace?: string;
}

async function logoutFromWorkspace(
  config: ConfigV2,
  workspaceId: string,
  workspaceName: string,
  allWorkspaces: { organizationId: string; organizationName: string }[]
): Promise<void> {
  await deleteWorkspace(workspaceId);

  if (config.currentWorkspace === workspaceId) {
    const remaining = allWorkspaces.filter((w) => w.organizationId !== workspaceId);
    if (remaining.length > 0) {
      await writeGlobalConfig({ version: 2, currentWorkspace: remaining[0]!.organizationId });
      console.log(`Logged out from: ${workspaceName}`);
      console.log(`Switched to: ${remaining[0]!.organizationName}`);
    } else {
      await writeGlobalConfig({ version: 2 });
      console.log(`Logged out from: ${workspaceName}`);
    }
  } else {
    console.log(`Logged out from: ${workspaceName}`);
  }
}

export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Remove stored credentials')
    .option('--all', 'Remove all workspaces')
    .option('-w, --workspace <name>', 'Remove a specific workspace by name')
    .action(async (options: LogoutOptions) => {
      if (process.env.LINEAR_API_KEY) {
        console.error('Error: LINEAR_API_KEY environment variable is set.');
        console.error('Unset it to manage workspace-based authentication.');
        process.exit(1);
      }

      if (options.all && options.workspace) {
        console.error('Error: --all and --workspace are mutually exclusive.');
        process.exit(1);
      }

      let config: ConfigV2;
      try {
        config = await ensureV2Config();
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
      const workspaces = await listWorkspaces();

      if (workspaces.length === 0) {
        console.error('Error: Not currently authenticated.');
        process.exit(1);
      }

      if (options.all) {
        for (const workspace of workspaces) {
          await deleteWorkspace(workspace.organizationId);
        }
        await writeGlobalConfig({ version: 2 });
        console.log(`Logged out from all ${workspaces.length} workspace(s)`);
        return;
      }

      if (options.workspace) {
        const workspace = await findWorkspaceByName(options.workspace);
        if (!workspace) {
          console.error(`Error: Workspace '${options.workspace}' not found.`);
          console.error('');
          console.error('Available workspaces:');
          for (const w of workspaces) {
            console.error(`  ${w.organizationName}`);
          }
          process.exit(1);
        }
        await logoutFromWorkspace(config, workspace.organizationId, workspace.organizationName, workspaces);
        return;
      }

      if (!config.currentWorkspace) {
        console.error('Error: No current workspace set.');
        process.exit(1);
      }

      const currentWorkspace = workspaces.find((w) => w.organizationId === config.currentWorkspace);
      if (!currentWorkspace) {
        console.error('Error: Current workspace not found.');
        process.exit(1);
      }

      await logoutFromWorkspace(config, currentWorkspace.organizationId, currentWorkspace.organizationName, workspaces);
    });
}
