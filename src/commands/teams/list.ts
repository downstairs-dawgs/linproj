import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import { LinearClient, getTeams } from '../../lib/api.ts';

interface ListOptions {
  json?: boolean;
  workspace?: string;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

export function createListCommand(): Command {
  return new Command('list')
    .description('List all teams')
    .option('--json', 'Output as JSON')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (options: ListOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);
      const teams = await getTeams(client);

      if (options.json) {
        console.log(JSON.stringify(teams, null, 2));
        return;
      }

      if (teams.length === 0) {
        console.log('No teams found.');
        return;
      }

      const keyWidth = Math.max(3, ...teams.map((t) => t.key.length));
      console.log(`${padRight('KEY', keyWidth)}  NAME`);
      for (const team of teams) {
        console.log(`${padRight(team.key, keyWidth)}  ${team.name}`);
      }
    });
}
