import { Command } from 'commander';
import { readConfig } from '../../lib/config.ts';
import {
  LinearClient,
  searchIssues,
  getViewer,
  type IssueFilter,
  type StateType,
} from '../../lib/api.ts';
import { outputIssues } from '../../lib/output.ts';

function parsePriority(value: string): number {
  const map: Record<string, number> = {
    none: 0,
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
  };
  const lower = value.toLowerCase();
  if (lower in map) {
    return map[lower]!;
  }
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 4) {
    throw new Error(`Invalid priority '${value}'. Use: none, urgent, high, medium, low, or 0-4`);
  }
  return num;
}

interface SearchOptions {
  team?: string;
  state?: string;
  stateType?: string;
  assignee?: string;
  priority?: string;
  limit?: string;
  json?: boolean;
}

export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search for issues by text')
    .argument('<query>', 'Search query')
    .option('-t, --team <team>', 'Filter by team key')
    .option('-s, --state <state>', 'Filter by state name')
    .option('--state-type <type>', 'Filter by state type (backlog, unstarted, started, completed, canceled)')
    .option('-a, --assignee <assignee>', 'Filter by assignee (me, none, or email)')
    .option('--priority <priority>', 'Filter by priority (urgent, high, medium, low, none, or 0-4)')
    .option('-n, --limit <number>', 'Maximum results', '25')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: SearchOptions) => {
      const config = await readConfig();

      if (!config.auth) {
        console.error('Error: Not authenticated');
        console.error('Run `linproj auth login` first');
        process.exit(1);
      }

      const limit = parseInt(options.limit ?? '25', 10);
      if (isNaN(limit) || limit < 1) {
        console.error('Error: Invalid limit value');
        process.exit(1);
      }

      const client = new LinearClient(config.auth);

      // Build filter
      const filter: IssueFilter = {};

      if (options.team) {
        filter.team = { key: { eq: options.team } };
      }

      if (options.state) {
        filter.state = { name: { eq: options.state } };
      }

      if (options.stateType) {
        const validTypes = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
        if (!validTypes.includes(options.stateType)) {
          console.error(`Error: Invalid state type '${options.stateType}'`);
          console.error(`Valid types: ${validTypes.join(', ')}`);
          process.exit(1);
        }
        filter.state = { type: { eq: options.stateType as StateType } };
      }

      if (options.assignee) {
        if (options.assignee === 'me') {
          const viewer = await getViewer(client);
          filter.assignee = { id: { eq: viewer.id } };
        } else if (options.assignee === 'none') {
          filter.assignee = { null: true };
        } else {
          filter.assignee = { email: { eq: options.assignee } };
        }
      }

      if (options.priority) {
        try {
          const priorityValue = parsePriority(options.priority);
          filter.priority = { eq: priorityValue };
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }
      }

      const issues = await searchIssues(
        client,
        query,
        Object.keys(filter).length > 0 ? filter : undefined,
        limit
      );

      outputIssues(issues, options.json ?? false);

      if (!options.json && issues.length > 0) {
        console.log();
        console.log(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'} matching "${query}"`);
      }
    });
}
