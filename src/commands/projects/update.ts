import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import {
  LinearClient,
  createProjectUpdate,
  type ProjectHealth,
} from '../../lib/api.ts';
import { resolveProjectForUpdate } from '../../lib/resolve.ts';

interface UpdateOptions {
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

async function readStdin(): Promise<string> {
  const isTTY = process.stdin.isTTY;
  if (isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

export function createUpdateCommand(): Command {
  return new Command('update')
    .description('Post a status update to a project')
    .argument('<project>', 'Project name or ID')
    .option('--body <text>', 'Update content (markdown supported)')
    .option('--health <status>', 'Health status: on-track, at-risk, off-track')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output on success')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (project: string, options: UpdateOptions) => {
      // Validate health status early (before any API calls)
      let health: ProjectHealth | undefined;
      if (options.health) {
        const healthLower = options.health.toLowerCase();
        if (!(healthLower in HEALTH_MAP)) {
          console.error(`Error: Invalid health status '${options.health}'.`);
          console.error('Valid values: on-track, at-risk, off-track');
          process.exit(1);
        }
        health = HEALTH_MAP[healthLower];
      }

      // Get body from --body flag or stdin
      let body = options.body ?? '';
      if (!body) {
        body = await readStdin();
      }

      if (!body) {
        console.error('Error: Update body is required. Use --body or pipe content via stdin.');
        process.exit(1);
      }

      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);

      // Resolve project name to ID
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

        if (options.quiet) {
          return;
        }

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
