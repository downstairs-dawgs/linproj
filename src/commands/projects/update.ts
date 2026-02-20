import { Command } from 'commander';
import { getAuthContextOrExit } from '../../lib/config.ts';
import {
  LinearClient,
  createProjectUpdate,
  listProjectUpdates,
  updateProjectUpdate,
  type ProjectHealth,
  type ProjectUpdate,
} from '../../lib/api.ts';
import { resolveProjectForUpdate } from '../../lib/resolve.ts';

interface CreateOptions {
  body?: string;
  health?: string;
  json?: boolean;
  quiet?: boolean;
  workspace?: string;
}

interface ListOptions {
  json?: boolean;
  limit?: string;
  workspace?: string;
}

interface EditOptions {
  body?: string;
  health?: string;
  json?: boolean;
  quiet?: boolean;
  workspace?: string;
}

const HEALTH_MAP: Record<string, ProjectHealth> = {
  'on-track': 'onTrack',
  'at-risk': 'atRisk',
  'off-track': 'offTrack',
};

const HEALTH_DISPLAY: Record<string, string> = {
  onTrack: 'On Track',
  atRisk: 'At Risk',
  offTrack: 'Off Track',
};

function parseHealth(value: string): ProjectHealth {
  const healthLower = value.toLowerCase();
  if (!(healthLower in HEALTH_MAP)) {
    console.error(`Error: Invalid health status '${value}'.`);
    console.error('Valid values: on-track, at-risk, off-track');
    process.exit(1);
  }
  return HEALTH_MAP[healthLower];
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function truncateId(id: string): string {
  return id.slice(0, 8);
}

function truncateBody(body: string, maxLen = 50): string {
  const firstLine = body.split('\n')[0].trim();
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen - 3) + '...';
}

function printUpdatesTable(updates: ProjectUpdate[]): void {
  if (updates.length === 0) {
    console.log('No updates found');
    return;
  }

  const dateWidth = 10;
  const healthWidth = Math.max(6, ...updates.map((u) => (HEALTH_DISPLAY[u.health] ?? u.health).length));
  const authorWidth = Math.max(6, ...updates.map((u) => u.user.name.length));
  const idWidth = 8;

  console.log(
    `${padRight('DATE', dateWidth)}  ${padRight('HEALTH', healthWidth)}  ${padRight('AUTHOR', authorWidth)}  ${padRight('ID', idWidth)}  BODY`
  );

  for (const update of updates) {
    console.log(
      `${padRight(formatDate(update.createdAt), dateWidth)}  ${padRight(HEALTH_DISPLAY[update.health] ?? update.health, healthWidth)}  ${padRight(update.user.name, authorWidth)}  ${padRight(truncateId(update.id), idWidth)}  ${truncateBody(update.body)}`
    );
  }
}

function createCreateSubcommand(): Command {
  return new Command('create')
    .description('Post a status update to a project')
    .argument('<project>', 'Project name or ID')
    .option('--body <text>', 'Update content (markdown supported)')
    .option('--health <status>', 'Health status: on-track, at-risk, off-track')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output on success')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (project: string, options: CreateOptions) => {
      let health: ProjectHealth | undefined;
      if (options.health) {
        health = parseHealth(options.health);
      }

      let body = options.body ?? '';
      if (!body) {
        body = await readStdin();
      }

      if (!body) {
        console.error('Error: Update body is required. Use --body or pipe content via stdin.');
        process.exit(1);
      }

      const ctx = await getAuthContextOrExit(options.workspace);
      const client = new LinearClient(ctx.auth);

      let projectId: string;
      try {
        projectId = await resolveProjectForUpdate(client, project);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      try {
        const update = await createProjectUpdate(client, {
          projectId,
          body,
          health,
        });

        if (options.quiet) return;

        if (options.json) {
          console.log(JSON.stringify(update, null, 2));
        } else {
          console.log(`Project update created: ${update.url}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

function createListSubcommand(): Command {
  return new Command('list')
    .description('List status updates for a project')
    .argument('<project>', 'Project name or ID')
    .option('--json', 'Output as JSON')
    .option('-n, --limit <n>', 'Maximum number of updates to show', '10')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (project: string, options: ListOptions) => {
      const limit = parseInt(options.limit ?? '10', 10);
      if (isNaN(limit) || limit < 1) {
        console.error('Error: Invalid limit value');
        process.exit(1);
      }

      const ctx = await getAuthContextOrExit(options.workspace);
      const client = new LinearClient(ctx.auth);

      let projectId: string;
      try {
        projectId = await resolveProjectForUpdate(client, project);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const updates = await listProjectUpdates(client, projectId, limit);

      if (options.json) {
        console.log(JSON.stringify(updates, null, 2));
        return;
      }

      printUpdatesTable(updates);
    });
}

function createEditSubcommand(): Command {
  return new Command('edit')
    .description('Edit an existing project update')
    .argument('<update-id>', 'Project update ID')
    .option('--body <text>', 'New update content (markdown supported)')
    .option('--health <status>', 'New health status: on-track, at-risk, off-track')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output on success')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (updateId: string, options: EditOptions) => {
      let health: ProjectHealth | undefined;
      if (options.health) {
        health = parseHealth(options.health);
      }

      let body = options.body;
      if (body === undefined) {
        const stdinBody = await readStdin();
        if (stdinBody) {
          body = stdinBody;
        }
      }

      if (!body && !health) {
        console.error('Error: At least one of --body or --health is required.');
        process.exit(1);
      }

      const ctx = await getAuthContextOrExit(options.workspace);
      const client = new LinearClient(ctx.auth);

      try {
        const update = await updateProjectUpdate(client, updateId, {
          ...(body !== undefined && { body }),
          ...(health !== undefined && { health }),
        });

        if (options.quiet) return;

        if (options.json) {
          console.log(JSON.stringify(update, null, 2));
        } else {
          console.log(`Project update edited: ${update.url}`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

export function createUpdateCommand(): Command {
  const update = new Command('update')
    .description('Manage project status updates');

  update.addCommand(createCreateSubcommand(), { isDefault: true });
  update.addCommand(createListSubcommand());
  update.addCommand(createEditSubcommand());

  return update;
}
