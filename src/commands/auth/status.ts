import { Command } from 'commander';
import {
  readGlobalConfig,
  getConfigVersion,
  getCurrentWorkspace,
  isUsingEnvAuth,
  type ConfigV1,
} from '../../lib/config.ts';
import { LinearClient, getViewer, LinearAPIError } from '../../lib/api.ts';

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show current authentication status')
    .action(async () => {
      // Check for env var auth first
      if (isUsingEnvAuth()) {
        const auth = { type: 'api-key' as const, apiKey: process.env.LINEAR_API_KEY! };
        const client = new LinearClient(auth);

        try {
          const user = await getViewer(client);
          console.log(`Logged in as ${user.name} (${user.email}) via API key (environment variable)`);
        } catch (err) {
          if (err instanceof LinearAPIError && err.status === 401) {
            console.log('Authentication expired or invalid (environment variable LINEAR_API_KEY)');
          } else {
            throw err;
          }
        }
        return;
      }

      const globalConfig = await readGlobalConfig();
      const version = getConfigVersion(globalConfig);

      // Handle v1 config
      if (version === 1) {
        const v1Config = globalConfig as ConfigV1;

        if (!v1Config.auth) {
          console.log('Not authenticated');
          console.log('Run `linproj auth login` to authenticate');
          return;
        }

        const method = v1Config.auth.type === 'api-key' ? 'API key' : 'OAuth';
        const client = new LinearClient(v1Config.auth);

        try {
          const user = await getViewer(client);
          console.log(`Logged in as ${user.name} (${user.email}) via ${method}`);
          console.log('');
          console.log('Note: Your config uses an older format.');
          console.log('Run `linproj config migrate` to enable workspace features.');
        } catch (err) {
          if (err instanceof LinearAPIError && err.status === 401) {
            console.log(`Authentication expired or invalid (${method})`);
            console.log('Run `linproj auth login` to re-authenticate');
          } else {
            throw err;
          }
        }
        return;
      }

      // Handle v2 config
      try {
        const workspace = await getCurrentWorkspace();
        const method = workspace.auth.type === 'api-key' ? 'API key' : 'OAuth';
        const client = new LinearClient(workspace.auth);

        try {
          const user = await getViewer(client);
          console.log(`Logged in as ${user.name} (${user.email}) via ${method}`);
          console.log(`Workspace: ${workspace.organizationName}`);
          if (workspace.defaultTeam) {
            console.log(`Default team: ${workspace.defaultTeam}`);
          }
        } catch (err) {
          if (err instanceof LinearAPIError && err.status === 401) {
            console.log(`Authentication expired or invalid (${method})`);
            console.log('Run `linproj auth login` to re-authenticate');
          } else {
            throw err;
          }
        }
      } catch (err) {
        console.log('Not authenticated');
        console.log('Run `linproj auth login` to authenticate');
      }
    });
}
