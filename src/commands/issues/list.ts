import { Command } from 'commander';
import { readConfig } from '../../lib/config.ts';
import { LinearClient, getAssignedIssues, type Issue } from '../../lib/api.ts';

function formatPriority(priority: number): string {
  // Linear priorities: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  switch (priority) {
    case 0:
      return '-';
    case 1:
      return 'Urgent';
    case 2:
      return 'High';
    case 3:
      return 'Medium';
    case 4:
      return 'Low';
    default:
      return String(priority);
  }
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function printIssuesTable(issues: Issue[]): void {
  if (issues.length === 0) {
    console.log('No issues assigned to you');
    return;
  }

  // Calculate column widths
  const idWidth = Math.max(2, ...issues.map((i) => i.identifier.length));
  const stateWidth = Math.max(5, ...issues.map((i) => i.state.name.length));
  const priorityWidth = 8;

  // Header
  console.log(
    `${padRight('ID', idWidth)}  ${padRight('STATE', stateWidth)}  ${padRight('PRIORITY', priorityWidth)}  TITLE`
  );

  // Rows
  for (const issue of issues) {
    console.log(
      `${padRight(issue.identifier, idWidth)}  ${padRight(issue.state.name, stateWidth)}  ${padRight(formatPriority(issue.priority), priorityWidth)}  ${issue.title}`
    );
  }
}

export function createListCommand(): Command {
  return new Command('list')
    .description('List issues assigned to you')
    .option('-n, --limit <number>', 'Maximum number of issues to show', '50')
    .action(async (options: { limit: string }) => {
      const config = await readConfig();

      if (!config.auth) {
        console.error('Error: Not authenticated');
        console.error('Run `linproj auth login` first');
        process.exit(1);
      }

      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit < 1) {
        console.error('Error: Invalid limit value');
        process.exit(1);
      }

      const client = new LinearClient(config.auth);
      const issues = await getAssignedIssues(client, limit);
      printIssuesTable(issues);
    });
}
