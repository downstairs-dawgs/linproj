import { Command } from 'commander';
import { readConfig } from '../../lib/config.ts';
import {
  LinearClient,
  getTeams,
  getViewer,
  createIssue,
  type Team,
} from '../../lib/api.ts';

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
  priority?: string;
}

export function createCreateCommand(): Command {
  return new Command('create')
    .description('Create a new issue')
    .option('-t, --team <team>', 'Team key (e.g., "ENG")')
    .option('--title <title>', 'Issue title')
    .option('-d, --description <description>', 'Issue description')
    .option('-a, --assign-to-me', 'Assign the issue to yourself')
    .option(
      '-p, --priority <priority>',
      'Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low'
    )
    .action(async (options: CreateOptions) => {
      const config = await readConfig();

      if (!config.auth) {
        console.error('Error: Not authenticated');
        console.error('Run `linproj auth login` first');
        process.exit(1);
      }

      const client = new LinearClient(config.auth);

      // Get teams
      const teams = await getTeams(client);
      if (teams.length === 0) {
        console.error('Error: No teams found in your workspace');
        process.exit(1);
      }

      // Select team
      let teamId: string;
      if (options.team) {
        const team = teams.find(
          (t) => t.key.toLowerCase() === options.team!.toLowerCase()
        );
        if (!team) {
          console.error(`Error: Team "${options.team}" not found`);
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

      // Get assignee if requested
      let assigneeId: string | undefined;
      if (options.assignToMe) {
        const viewer = await getViewer(client);
        assigneeId = viewer.id;
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

      // Create the issue
      const issue = await createIssue(client, {
        teamId,
        title: title.trim(),
        description: options.description,
        priority,
        assigneeId,
      });

      console.log(`✓ Created issue ${issue.identifier}: ${issue.title}`);
    });
}
