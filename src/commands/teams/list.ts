import { Command } from 'commander';
import { getAuthContextOrExit } from '../../lib/config.ts';
import { LinearClient, getTeams } from '../../lib/api.ts';
import { padRight } from '../../lib/output.ts';

interface ListOptions {
  json?: boolean;
  workspace?: string;
}

export function createListCommand(): Command {
  return new Command('list')
    .description('List all teams')
    .option('--json', 'Output as JSON')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (options: ListOptions) => {
      const ctx = await getAuthContextOrExit(options.workspace);
      const client = new LinearClient(ctx.auth);

      try {
        const teams = await getTeams(client);

        if (options.json) {
          console.log(JSON.stringify(teams, null, 2));
          return;
        }

        if (teams.length === 0) {
          console.log('No teams found.');
          return;
        }

        const keyWidth = Math.max(3, ...teams.map((team) => team.key.length));
        console.log(`${padRight('KEY', keyWidth)}  NAME`);
        for (const team of teams) {
          console.log(`${padRight(team.key, keyWidth)}  ${team.name}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
