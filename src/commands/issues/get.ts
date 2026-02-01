import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import {
  LinearClient,
  getIssue,
  getComments,
  buildCommentTree,
  type Issue,
  type CommentNode,
} from '../../lib/api.ts';
import { countComments, printCommentTree } from '../../lib/comments-display.ts';
import { renderMarkdown } from '../../lib/terminal-markdown.ts';

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

const DEFAULT_COMMENTS_LIMIT = 3;

function printIssueDetails(
  issue: Issue,
  commentTree?: CommentNode[],
  options?: { raw?: boolean }
): void {
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
    if (options?.raw) {
      console.log(issue.description);
    } else {
      console.log(renderMarkdown(issue.description));
    }
  }

  console.log();
  console.log(`URL: ${issue.url}`);

  // Print comments section if comments were fetched
  if (commentTree !== undefined) {
    console.log();
    console.log('━'.repeat(50));

    if (commentTree.length === 0) {
      console.log('No comments');
    } else {
      const totalCount = countComments(commentTree);
      const displayedTree = commentTree.slice(0, DEFAULT_COMMENTS_LIMIT);
      const displayedCount = countComments(displayedTree);
      const remainingTopLevel = commentTree.length - displayedTree.length;

      console.log(`Comments (${totalCount}):`);
      console.log();

      printCommentTree(displayedTree);

      if (remainingTopLevel > 0) {
        const remainingTotal = totalCount - displayedCount;
        console.log(`... ${remainingTotal} more comment${remainingTotal === 1 ? '' : 's'}`);
        console.log(`Run 'linproj issues comments ${issue.identifier}' to see all`);
      }
    }
  }
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
  comments?: boolean; // defaults to true, set to false by --no-comments
  raw?: boolean;
}

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a single issue by identifier')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--json', 'Output as JSON')
    .option('--field <field>', 'Output a single field (id, url, state, etc.)')
    .option('--no-comments', 'Exclude comments from output')
    .option('--raw', 'Show raw markdown without rendering')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (identifier: string, options: GetOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);
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

      // Fetch comments unless --no-comments is set (comments defaults to true)
      let commentTree: CommentNode[] | undefined;
      if (options.comments !== false) {
        const result = await getComments(client, identifier);
        if (result) {
          commentTree = buildCommentTree(result.comments);
        }
      }

      if (options.json) {
        const output: Record<string, unknown> = { ...issue };
        if (commentTree !== undefined) {
          // Apply truncation for JSON output too
          const displayedTree = commentTree.slice(0, DEFAULT_COMMENTS_LIMIT);
          output.comments = displayedTree;
          output.totalComments = countComments(commentTree);
        }
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      printIssueDetails(issue, commentTree, { raw: options.raw });
    });
}
