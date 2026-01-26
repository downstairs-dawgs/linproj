import { Command } from 'commander';
import { getAuthContext } from '../../lib/config.ts';
import {
  LinearClient,
  getIssue,
  updateIssue,
  getWorkflowStates,
  type Issue,
} from '../../lib/api.ts';
import { resolveTeam } from '../../lib/resolve.ts';

export interface DoneOptions {
  json?: boolean;
  quiet?: boolean;
  workspace?: string;
}

async function getCompletedStateId(
  client: LinearClient,
  teamId: string
): Promise<string> {
  const states = await getWorkflowStates(client, teamId);
  const completedState = states.find((s) => s.type === 'completed');
  if (!completedState) {
    throw new Error('No completed state found for this team');
  }
  return completedState.id;
}

function printResult(issue: Issue, previousState: string): void {
  console.log(`✓ ${issue.identifier} → ${issue.state.name} (was: ${previousState})`);
  console.log();
  console.log(issue.url);
}

export function createDoneCommand(): Command {
  return new Command('done')
    .description('Mark an issue as done')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output on success')
    .option('-w, --workspace <name>', 'Use a different workspace')
    .action(async (identifier: string, options: DoneOptions) => {
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

      if (!issue.team?.key) {
        console.error('Error: Issue has no team');
        process.exit(1);
      }

      // Check if already completed
      if (issue.state.type === 'completed') {
        if (!options.quiet) {
          console.log(`Issue ${identifier} is already done (${issue.state.name})`);
        }
        return;
      }

      const previousState = issue.state.name;
      const teamId = await resolveTeam(client, issue.team.key);
      const stateId = await getCompletedStateId(client, teamId);

      const updated = await updateIssue(client, issue.id, { stateId });

      if (options.quiet) {
        return;
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: true,
              issue: updated,
              changes: {
                state: { from: previousState, to: updated.state.name },
              },
            },
            null,
            2
          )
        );
        return;
      }

      printResult(updated, previousState);
    });
}
