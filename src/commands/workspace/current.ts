import { Command } from 'commander';
import { getCurrentWorkspace, requireWorkspaceAuth } from '../../lib/config.ts';

export function createCurrentCommand(): Command {
  return new Command('current')
    .description('Show the current workspace')
    .action(async () => {
      try {
        requireWorkspaceAuth();
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
