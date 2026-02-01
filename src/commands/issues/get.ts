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

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

function getAuthorDisplay(comment: CommentNode): string {
  if (comment.botActor) {
    return `Bot: ${comment.botActor.name}`;
  }
  return comment.user?.name ?? 'Unknown';
}

function countComments(nodes: CommentNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    count += countComments(node.children);
  }
  return count;
}

function printCommentTree(nodes: CommentNode[], depth = 0): void {
  const indent = '  '.repeat(depth);

  for (const node of nodes) {
    const author = getAuthorDisplay(node);
    const time = formatRelativeTime(node.createdAt);
    const replyTag = depth > 0 ? ' (reply)' : '';
    const resolvedTag = node.resolvingUser ? ' [resolved]' : '';
    const editedTag = node.editedAt ? ' (edited)' : '';

    // Header line
    console.log(`${indent}--- ${author} · ${time}${replyTag}${editedTag}${resolvedTag} ---`);

    // Body - print each line with indentation
    const lines = node.body.split('\n');
    for (const line of lines) {
      console.log(`${indent}${line}`);
    }

    // Print children (replies)
    if (node.children.length > 0) {
      console.log();
      printCommentTree(node.children, depth + 1);
    }

    // Blank line after each top-level comment
    if (depth === 0) {
      console.log();
    }
  }
}

const DEFAULT_COMMENTS_LIMIT = 3;

function printIssueDetails(issue: Issue, commentTree?: CommentNode[]): void {
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
}

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a single issue by identifier')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--json', 'Output as JSON')
    .option('--field <field>', 'Output a single field (id, url, state, etc.)')
    .option('--no-comments', 'Exclude comments from output')
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

      printIssueDetails(issue, commentTree);
    });
}
