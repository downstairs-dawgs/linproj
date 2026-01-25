import { Command } from 'commander';
import {
  getAuth,
  listWorkspaces,
  isUsingEnvAuth,
} from '../../lib/config.ts';
import { LinearClient, getIssue, type Issue } from '../../lib/api.ts';

function formatPriority(priority: number): string {
  switch (priority) {
    case 0:
      return 'None';
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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString();
}

function printIssueDetails(issue: Issue): void {
  console.log(`${issue.identifier}: ${issue.title}`);
  console.log('━'.repeat(50));
  console.log();
  console.log(`State:     ${issue.state.name}`);
  console.log(`Priority:  ${formatPriority(issue.priority)}`);

  if (issue.team) {
    console.log(`Team:      ${issue.team.name} (${issue.team.key})`);
  }

  if (issue.assignee) {
    console.log(`Assignee:  ${issue.assignee.name}`);
  }

  if (issue.labels && issue.labels.nodes.length > 0) {
    console.log(`Labels:    ${issue.labels.nodes.map((l) => l.name).join(', ')}`);
  }

  if (issue.project) {
    console.log(`Project:   ${issue.project.name}`);
  }

  console.log(`Created:   ${formatDate(issue.createdAt)}`);
  console.log(`Updated:   ${formatDate(issue.updatedAt)}`);

  if (issue.description) {
    console.log();
    console.log('Description:');
    console.log(issue.description);
  }

  console.log();
  console.log(`URL: ${issue.url}`);
}

function getFieldValue(issue: Issue, field: string): string {
  switch (field) {
    case 'id':
      return issue.id;
    case 'identifier':
      return issue.identifier;
    case 'title':
      return issue.title;
    case 'description':
      return issue.description ?? '';
    case 'url':
      return issue.url;
    case 'state':
      return issue.state.name;
    case 'state-type':
      return issue.state.type;
    case 'priority':
      return String(issue.priority);
    case 'team':
      return issue.team?.key ?? '';
    case 'assignee':
      return issue.assignee?.email ?? '';
    case 'labels':
      return issue.labels?.nodes.map((l) => l.name).join(',') ?? '';
    case 'project':
      return issue.project?.name ?? '';
    case 'created':
      return issue.createdAt;
    case 'updated':
      return issue.updatedAt;
    default:
      throw new Error(
        `Unknown field '${field}'. Valid fields: id, identifier, title, description, url, state, state-type, priority, team, assignee, labels, project, created, updated`
      );
  }
}

interface GetOptions {
  json?: boolean;
  field?: string;
  workspace?: string;
}

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a single issue by identifier')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--json', 'Output as JSON')
    .option('--field <field>', 'Output a single field (id, url, state, etc.)')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (identifier: string, options: GetOptions) => {
      let auth;

      try {
        // Handle workspace override
        if (options.workspace && !isUsingEnvAuth()) {
          const workspaces = await listWorkspaces();
          const workspace = workspaces.find(
            (w) => w.organizationName.toLowerCase() === options.workspace!.toLowerCase()
          );
          if (!workspace) {
            console.error(`Error: Workspace '${options.workspace}' not found.`);
            process.exit(1);
          }
          auth = workspace.auth;
        } else {
          auth = await getAuth();
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(auth);
      const issue = await getIssue(client, identifier);

      if (!issue) {
        console.error(`Error: Issue '${identifier}' not found`);
        process.exit(1);
      }

      if (options.field) {
        try {
          console.log(getFieldValue(issue, options.field));
        } catch (err) {
          console.error((err as Error).message);
          process.exit(1);
        }
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(issue, null, 2));
        return;
      }

      printIssueDetails(issue);
    });
}
