import { Command } from 'commander';
import { readConfig } from '../../lib/config.ts';
import { LinearClient, getViewer, LinearAPIError } from '../../lib/api.ts';

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show current authentication status')
    .action(async () => {
      const config = await readConfig();

      if (!config.auth) {
        console.log('Not authenticated');
        console.log('Run `linproj auth login` to authenticate');
        return;
      }

      const method = config.auth.type === 'api-key' ? 'API key' : 'OAuth';

      // Verify the token is still valid
      const client = new LinearClient(config.auth);
      try {
        const user = await getViewer(client);
        console.log(`Logged in as ${user.name} (${user.email}) via ${method}`);
      } catch (err) {
        if (err instanceof LinearAPIError && err.status === 401) {
          console.log(`Authentication expired or invalid (${method})`);
          console.log('Run `linproj auth login` to re-authenticate');
        } else {
          throw err;
        }
      }
    });
}
