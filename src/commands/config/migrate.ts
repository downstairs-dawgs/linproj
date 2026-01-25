import { Command } from 'commander';
import {
  readGlobalConfig,
  writeGlobalConfig,
  writeWorkspace,
  getConfigVersion,
  type ConfigV1,
  type ConfigV2,
  type WorkspaceProfile,
} from '../../lib/config.ts';
import { LinearClient, getOrganization, LinearAPIError } from '../../lib/api.ts';

export function createMigrateCommand(): Command {
  return new Command('migrate')
    .description('Migrate v1 config to v2 format with workspaces')
    .action(async () => {
      const globalConfig = await readGlobalConfig();
      const version = getConfigVersion(globalConfig);

      if (version === 2) {
        console.log('Config is already v2 format. No migration needed.');
        return;
      }

      const v1Config = globalConfig as ConfigV1;

      if (!v1Config.auth) {
        console.error('Error: No auth credentials found in v1 config.');
        console.error('Run `linproj auth login` first.');
        process.exit(1);
      }

      console.log('Fetching organization info...');

      try {
        const client = new LinearClient(v1Config.auth);
        const org = await getOrganization(client);

        // Create workspace profile
        const workspace: WorkspaceProfile = {
          organizationId: org.id,
          organizationName: org.name,
          urlKey: org.urlKey,
          auth: v1Config.auth,
        };

        await writeWorkspace(workspace);

        // Write v2 global config
        const v2Config: ConfigV2 = {
          version: 2,
          currentWorkspace: org.id,
        };

        await writeGlobalConfig(v2Config);

        console.log(`Created workspace: ${org.name}`);
        console.log('Migration complete.');
      } catch (err) {
        if (err instanceof LinearAPIError) {
          if (err.status === 401) {
            console.error('Error: Invalid or expired auth credentials.');
            console.error('Run `linproj auth login` to re-authenticate.');
          } else {
            console.error(`Error: ${err.message}`);
          }
        } else {
          console.error(`Error: ${err}`);
        }
        process.exit(1);
      }
    });
}
