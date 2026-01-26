import { Command } from 'commander';
import {
  listWorkspaces,
  setCurrentWorkspace,
  findWorkspaceByName,
  requireWorkspaceAuth,
} from '../../lib/config.ts';

export function createSwitchCommand(): Command {
  return new Command('switch')
    .description('Switch to a different workspace')
    .argument('<name>', 'Workspace name (organization name) to switch to')
    .action(async (name: string) => {
      try {
        requireWorkspaceAuth();
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const workspace = await findWorkspaceByName(name);

      if (!workspace) {
        const workspaces = await listWorkspaces();
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
    });
}
