import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import {
  LinearClient,
  getTeams,
  getIssue,
  createIssue,
} from '../../lib/api.ts';
import {
  resolveAssignee,
  resolveLabels,
  resolveProject,
  resolveState,
} from '../../lib/resolve.ts';

function collect(value: string, previous: string[] = []): string[] {
  return previous.concat([value]);
}

async function promptSelection(
  prompt: string,
  options: { label: string; value: string }[]
): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive selection requires a TTY');
  }

  console.log(prompt);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });

  process.stdout.write('Select (number): ');

  return new Promise((resolve, reject) => {
    let input = '';

    const onData = (data: Buffer) => {
      const char = data.toString('utf-8');

      if (char === '\n' || char === '\r') {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        process.stdout.write('\n');

        const num = parseInt(input.trim(), 10);
        if (isNaN(num) || num < 1 || num > options.length) {
          reject(new Error('Invalid selection'));
          return;
        }
        resolve(options[num - 1]!.value);
        return;
      }

      if (char === '\x03') {
        process.stdout.write('\n');
        process.exit(1);
      }

      if (char === '\x7f' || char === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      input += char;
      process.stdout.write(char);
    };

    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function promptText(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive input requires a TTY');
  }

  process.stdout.write(prompt);

  return new Promise((resolve) => {
    let input = '';

    const onData = (data: Buffer) => {
      const char = data.toString('utf-8');

      if (char === '\n' || char === '\r') {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(input);
        return;
      }

      if (char === '\x03') {
        process.stdout.write('\n');
        process.exit(1);
      }

      if (char === '\x7f' || char === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      input += char;
      process.stdout.write(char);
    };

    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

interface CreateOptions {
  team?: string;
  title?: string;
  description?: string;
  assignToMe?: boolean;
  assignee?: string;
  priority?: string;
  parent?: string;
  project?: string;
  state?: string;
  label?: string[];
  workspace?: string;
}

export function createCreateCommand(): Command {
  return new Command('create')
    .description('Create a new issue')
    .option('-t, --team <team>', 'Team key (e.g., "ENG")')
    .option('--title <title>', 'Issue title')
    .option('-d, --description <description>', 'Issue description')
    .option('-a, --assign-to-me', 'Assign the issue to yourself')
    .option('--assignee <assignee>', 'Assignee: email or "me"')
    .option(
      '-p, --priority <priority>',
      'Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low'
    )
    .option('--parent <identifier>', 'Parent issue identifier (creates a sub-issue)')
    .option('--project <project>', "Project name (defaults to the parent's project)")
    .option('--state <state>', 'State name')
    .option('--label <label>', 'Label (repeatable)', collect)
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (options: CreateOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);

      // Get teams
      const teams = await getTeams(client);
      if (teams.length === 0) {
        console.error('Error: No teams found in your workspace');
        process.exit(1);
      }

      let teamId: string;
      const teamKey = options.team ?? ctx.defaultTeam;
      if (teamKey) {
        const team = teams.find(
          (t) => t.key.toLowerCase() === teamKey.toLowerCase()
        );
        if (!team) {
          console.error(`Error: Team "${teamKey}" not found`);
          console.error('Available teams:', teams.map((t) => t.key).join(', '));
          process.exit(1);
        }
        teamId = team.id;
      } else if (teams.length === 1) {
        teamId = teams[0]!.id;
        console.log(`Using team: ${teams[0]!.name} (${teams[0]!.key})`);
      } else {
        teamId = await promptSelection(
          'Select a team:',
          teams.map((t) => ({ label: `${t.name} (${t.key})`, value: t.id }))
        );
      }

      // Get title
      let title = options.title;
      if (!title) {
        title = await promptText('Title: ');
        if (!title.trim()) {
          console.error('Error: Title is required');
          process.exit(1);
        }
      }

      if (options.assignToMe && options.assignee) {
        console.error('Error: Use either --assign-to-me or --assignee, not both');
        process.exit(1);
      }

      // Parse priority
      let priority: number | undefined;
      if (options.priority !== undefined) {
        priority = parseInt(options.priority, 10);
        if (isNaN(priority) || priority < 0 || priority > 4) {
          console.error('Error: Priority must be 0-4');
          process.exit(1);
        }
      }

      let parentId: string | undefined;
      let projectId: string | undefined;
      if (options.parent) {
        const parentIssue = await getIssue(client, options.parent);
        if (!parentIssue) {
          console.error(`Error: Parent issue '${options.parent}' not found`);
          process.exit(1);
        }
        parentId = parentIssue.id;
        projectId = parentIssue.project?.id;
      }

      let assigneeId: string | undefined;
      let stateId: string | undefined;
      let labelIds: string[] | undefined;
      try {
        const assignee = options.assignToMe ? 'me' : options.assignee;
        if (assignee) {
          assigneeId = (await resolveAssignee(client, assignee)) ?? undefined;
        }
        if (options.project) {
          projectId = (await resolveProject(client, options.project)) ?? undefined;
        }
        if (options.state) {
          stateId = await resolveState(client, teamId, options.state);
        }
        if (options.label) {
          labelIds = await resolveLabels(client, teamId, options.label);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const issue = await createIssue(client, {
        teamId,
        title: title.trim(),
        description: options.description,
        priority,
        assigneeId,
        parentId,
        projectId,
        stateId,
        labelIds,
      });

      if (options.parent) {
        console.log(`✓ Created sub-issue ${issue.identifier}: ${issue.title} (parent: ${options.parent})`);
      } else {
        console.log(`✓ Created issue ${issue.identifier}: ${issue.title}`);
      }
    });
}
