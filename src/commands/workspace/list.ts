import { Command } from 'commander';
import {
  readGlobalConfig,
  listWorkspaces,
  requireWorkspaceAuth,
  type ConfigV2,
} from '../../lib/config.ts';

export function createListCommand(): Command {
  return new Command('list')
    .description('List all configured workspaces')
    .action(async () => {
      try {
        requireWorkspaceAuth();
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const globalConfig = await readGlobalConfig();
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
    });
}
