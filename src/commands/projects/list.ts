import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import { LinearClient, getProjects } from '../../lib/api.ts';

interface ListOptions {
  json?: boolean;
  workspace?: string;
}

export function createListCommand(): Command {
  return new Command('list')
    .description('List all projects')
    .option('--json', 'Output as JSON')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (options: ListOptions) => {
      let ctx;
      try {
        ctx = await getAuthContext(options.workspace);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const client = new LinearClient(ctx.auth);
      const projects = await getProjects(client);

      if (options.json) {
        console.log(JSON.stringify(projects, null, 2));
      } else {
        if (projects.length === 0) {
          console.log('No projects found.');
          return;
        }
        for (const project of projects) {
          console.log(project.name);
        }
      }
    });
}
