import { Command } from 'commander';
import {
  readGlobalConfig,
  getConfigVersion,
  getCurrentWorkspace,
  isUsingEnvAuth,
} from '../../lib/config.ts';
import { LinearClient, getViewer, LinearAPIError } from '../../lib/api.ts';

async function showAuthStatus(client: LinearClient, method: string): Promise<boolean> {
  try {
    const user = await getViewer(client);
    console.log(`Logged in as ${user.name} (${user.email}) via ${method}`);
    return true;
  } catch (err) {
    if (err instanceof LinearAPIError && err.status === 401) {
      console.log(`Authentication expired or invalid (${method})`);
      console.log('Run `linproj auth login` to re-authenticate');
      return false;
    }
    throw err;
  }
}

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show current authentication status')
    .action(async () => {
      if (isUsingEnvAuth()) {
        const auth = { type: 'api-key' as const, apiKey: process.env.LINEAR_API_KEY! };
        await showAuthStatus(new LinearClient(auth), 'API key (environment variable)');
        return;
      }

      const globalConfig = await readGlobalConfig();
      const version = getConfigVersion(globalConfig);

      if (version === 1) {
        console.error('Error: Config migration required.');
        console.error('Run `linproj config migrate` to update your configuration.');
        process.exit(1);
      }

      try {
        const workspace = await getCurrentWorkspace();
        const method = workspace.auth.type === 'api-key' ? 'API key' : 'OAuth';
        const ok = await showAuthStatus(new LinearClient(workspace.auth), method);
        if (ok) {
          console.log(`Workspace: ${workspace.organizationName}`);
          if (workspace.defaultTeam) {
            console.log(`Default team: ${workspace.defaultTeam}`);
          }
        }
      } catch {
        console.log('Not authenticated');
        console.log('Run `linproj auth login` to authenticate');
      }
    });
}
