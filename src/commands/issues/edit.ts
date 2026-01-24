import { Command } from 'commander';
import { readConfig } from '../../lib/config.ts';
import {
  LinearClient,
  getIssue,
  updateIssue,
  type Issue,
  type IssueUpdateInput,
} from '../../lib/api.ts';
import {
  parseFrontmatter,
  renderFrontmatter,
  type EditFields,
} from '../../lib/frontmatter.ts';
import {
  resolveState,
  resolveLabels,
  resolveAssignee,
  resolveProject,
  resolveTeam,
  resolvePriority,
} from '../../lib/resolve.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// Exported types for testing
export interface EditOptions {
  title?: string;
  state?: string;
  priority?: string;
  assignee?: string;
  label?: string[];
  project?: string;
  team?: string;
  dueDate?: string;
  estimate?: string;
  interactive?: boolean;
  json?: boolean;
  quiet?: boolean;
  recover?: string;
}

export interface EditResult {
  success: boolean;
  cancelled?: boolean;
  noChanges?: boolean;
  error?: string;
  recoveryPath?: string;
  issue?: Issue;
  changes?: Changes;
}

export interface Changes {
  [key: string]: { from: unknown; to: unknown };
}

// Editor function type for dependency injection
export type EditorFn = (content: string, identifier: string) => Promise<string>;

// Dependencies that can be injected for testing
export interface EditDeps {
  openEditor?: EditorFn;
  readStdin?: () => Promise<string>;
  hasStdinData?: () => boolean;
  isTTY?: boolean;
}

function collect(value: string, previous: string[] = []): string[] {
  return previous.concat([value]);
}

function formatPriorityName(priority: number): string {
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

function defaultHasStdinData(): boolean {
  // Check if stdin is piped (not a TTY)
  return !process.stdin.isTTY;
}

async function defaultReadStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function findEditor(name: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(['which', name], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      return name;
    }
  } catch {}
  return null;
}

export async function defaultOpenEditor(
  content: string,
  identifier: string
): Promise<string> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const tempPath = join(tmpdir(), `linproj-edit-${identifier}-${suffix}.md`);

  await Bun.write(tempPath, content);

  const editor =
    process.env.EDITOR ||
    (await findEditor('vim')) ||
    (await findEditor('nano'));

  if (!editor) {
    await Bun.file(tempPath).unlink?.();
    throw new Error('No editor found. Set $EDITOR or install vim/nano');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(editor, [tempPath], {
      stdio: 'inherit',
    });

    child.on('error', async (err) => {
      try {
        await Bun.file(tempPath).unlink?.();
      } catch {}
      reject(new Error(`Failed to start editor: ${err.message}`));
    });

    child.on('exit', async (code) => {
      if (code !== 0) {
        try {
          await Bun.file(tempPath).unlink?.();
        } catch {}
        reject(new Error(`Editor exited with status ${code}`));
        return;
      }

      try {
        const result = await Bun.file(tempPath).text();
        try {
          await Bun.file(tempPath).unlink?.();
        } catch {}
        resolve(result);
      } catch (err) {
        reject(
          new Error(
            `Failed to read edited file: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    });
  });
}

async function buildUpdateInput(
  client: LinearClient,
  issue: Issue,
  fields: EditFields,
  description?: string
): Promise<{ input: IssueUpdateInput; changes: Changes }> {
  const input: IssueUpdateInput = {};
  const changes: Changes = {};
  const teamId = issue.team?.key ? await getTeamIdFromIssue(client, issue) : '';

  if (fields.title !== undefined) {
    input.title = fields.title;
    if (fields.title !== issue.title) {
      changes.title = { from: issue.title, to: fields.title };
    }
  }

  if (fields.state !== undefined) {
    const tid = fields.team ? await resolveTeam(client, fields.team) : teamId;
    input.stateId = await resolveState(client, tid, fields.state);
    if (fields.state.toLowerCase() !== issue.state.name.toLowerCase()) {
      changes.state = { from: issue.state.name, to: fields.state };
    }
  }

  if (fields.priority !== undefined) {
    input.priority = resolvePriority(fields.priority);
    if (input.priority !== issue.priority) {
      changes.priority = {
        from: formatPriorityName(issue.priority),
        to: formatPriorityName(input.priority),
      };
    }
  }

  if (fields.assignee !== undefined) {
    input.assigneeId = await resolveAssignee(client, fields.assignee);
    const currentEmail = issue.assignee?.email || 'none';
    const newAssignee =
      fields.assignee === 'none'
        ? 'none'
        : fields.assignee === 'me'
          ? 'me'
          : fields.assignee;
    if (
      (input.assigneeId === null && issue.assignee) ||
      (input.assigneeId !== null && !issue.assignee) ||
      (input.assigneeId !== null &&
        issue.assignee &&
        input.assigneeId !== issue.assignee.id)
    ) {
      changes.assignee = { from: currentEmail, to: newAssignee };
    }
  }

  if (fields.labels !== undefined) {
    const tid = fields.team ? await resolveTeam(client, fields.team) : teamId;
    input.labelIds = await resolveLabels(client, tid, fields.labels);
    const currentLabels = issue.labels?.nodes.map((l) => l.name) || [];
    const newLabels = fields.labels;
    if (
      JSON.stringify(currentLabels.sort()) !== JSON.stringify(newLabels.sort())
    ) {
      changes.labels = {
        from: currentLabels.join(', ') || 'none',
        to: newLabels.join(', ') || 'none',
      };
    }
  }

  if (fields.project !== undefined) {
    input.projectId = await resolveProject(client, fields.project);
    const currentProject = issue.project?.name || 'none';
    if (
      (input.projectId === null && issue.project) ||
      (input.projectId !== null && !issue.project) ||
      fields.project.toLowerCase() !== currentProject.toLowerCase()
    ) {
      changes.project = { from: currentProject, to: fields.project };
    }
  }

  if (fields.team !== undefined) {
    input.teamId = await resolveTeam(client, fields.team);
    const currentTeam = issue.team?.key || '';
    if (fields.team.toLowerCase() !== currentTeam.toLowerCase()) {
      changes.team = { from: currentTeam, to: fields.team };
    }
  }

  if (fields.dueDate !== undefined) {
    input.dueDate = fields.dueDate === 'none' ? null : fields.dueDate;
    changes.dueDate = { from: 'unknown', to: fields.dueDate };
  }

  if (fields.estimate !== undefined) {
    input.estimate = fields.estimate;
    changes.estimate = { from: 'unknown', to: fields.estimate };
  }

  if (description !== undefined) {
    input.description = description;
    if (description !== (issue.description || '')) {
      changes.description = {
        from: issue.description ? '(has description)' : '(empty)',
        to: description ? '(updated)' : '(cleared)',
      };
    }
  }

  return { input, changes };
}

async function getTeamIdFromIssue(
  client: LinearClient,
  issue: Issue
): Promise<string> {
  if (!issue.team?.key) {
    throw new Error('Issue has no team');
  }
  return resolveTeam(client, issue.team.key);
}

function fieldsFromOptions(options: EditOptions): EditFields {
  const fields: EditFields = {};

  if (options.title) fields.title = options.title;
  if (options.state) fields.state = options.state;
  if (options.priority)
    fields.priority = options.priority.toLowerCase() as EditFields['priority'];
  if (options.assignee) fields.assignee = options.assignee;
  if (options.label) {
    // Handle empty string as clear-all
    if (options.label.length === 1 && options.label[0] === '') {
      fields.labels = [];
    } else {
      fields.labels = options.label;
    }
  }
  if (options.project) fields.project = options.project;
  if (options.team) fields.team = options.team;
  if (options.dueDate) fields.dueDate = options.dueDate;
  if (options.estimate) fields.estimate = parseFloat(options.estimate);

  return fields;
}

export async function saveRecoveryFile(
  identifier: string,
  content: string
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const recoveryPath = join(
    tmpdir(),
    `linproj-recovery-${identifier}-${timestamp}.md`
  );
  await Bun.write(recoveryPath, content);
  return recoveryPath;
}

function hasMutationFlags(options: EditOptions): boolean {
  return !!(
    options.title ||
    options.state ||
    options.priority ||
    options.assignee ||
    options.label ||
    options.project ||
    options.team ||
    options.dueDate ||
    options.estimate
  );
}

/**
 * Core edit logic - separated for testability via dependency injection.
 * Returns a result object instead of printing/exiting for easier testing.
 */
export async function executeEdit(
  client: LinearClient,
  identifier: string,
  issue: Issue,
  options: EditOptions,
  deps: EditDeps = {}
): Promise<EditResult> {
  const openEditor = deps.openEditor ?? defaultOpenEditor;
  const readStdin = deps.readStdin ?? defaultReadStdin;
  const hasStdinData = deps.hasStdinData ?? defaultHasStdinData;
  const isTTY = deps.isTTY ?? process.stdin.isTTY;

  // Determine input mode
  const hasFlags = hasMutationFlags(options);
  const hasRecover = !!options.recover;
  const hasInteractive = !!options.interactive;

  // When -i or --recover is explicitly specified, they take precedence
  // Only check for stdin if neither is specified
  const hasStdin = !hasInteractive && !hasRecover && hasStdinData();

  // Check for mutual exclusivity
  if (hasStdin && hasFlags) {
    return {
      success: false,
      error: 'Cannot combine stdin input with mutation flags.',
    };
  }
  if (hasFlags && hasRecover) {
    return {
      success: false,
      error: 'Cannot combine flags with --recover.',
    };
  }

  let fields: EditFields;
  let description: string | undefined;
  let rawInput: string | undefined;

  try {
    // Determine input source and get raw input
    if (hasRecover) {
      // Recovery mode - open editor with recovery file contents
      let recoveryContent: string;
      try {
        recoveryContent = await Bun.file(options.recover!).text();
      } catch {
        return {
          success: false,
          error: `Could not read recovery file '${options.recover}'`,
        };
      }

      const edited = await openEditor(recoveryContent, identifier);

      if (edited.trim() === '') {
        return { success: true, cancelled: true };
      }

      rawInput = edited;
    } else if (hasStdin) {
      rawInput = await readStdin();
    } else if (options.interactive || (!hasFlags && isTTY)) {
      const original = renderFrontmatter(issue);
      const edited = await openEditor(original, identifier);

      if (edited.trim() === '' || edited === original) {
        return { success: true, cancelled: true };
      }

      rawInput = edited;
    } else if (hasFlags) {
      fields = fieldsFromOptions(options);
    } else {
      return {
        success: false,
        error: 'No changes specified. Use flags (--title, --state, etc.) or pipe input via stdin',
      };
    }

    // Parse frontmatter if we have raw input
    if (rawInput) {
      try {
        const parsed = parseFrontmatter(rawInput);
        fields = parsed.fields;
        description = parsed.description;
      } catch (err) {
        const recoveryPath = await saveRecoveryFile(identifier, rawInput);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          recoveryPath,
        };
      }
    }

    // Build the update input and track changes
    let input: IssueUpdateInput;
    let changes: Changes;
    try {
      const result = await buildUpdateInput(client, issue, fields!, description);
      input = result.input;
      changes = result.changes;
    } catch (err) {
      if (rawInput) {
        const recoveryPath = await saveRecoveryFile(identifier, rawInput);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          recoveryPath,
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Check if there are any changes
    if (Object.keys(input).length === 0) {
      return { success: true, noChanges: true };
    }

    // Execute the update
    let updated: Issue;
    try {
      updated = await updateIssue(client, issue.id, input);
    } catch (err) {
      if (rawInput) {
        const recoveryPath = await saveRecoveryFile(identifier, rawInput);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          recoveryPath,
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    return {
      success: true,
      issue: updated,
      changes,
    };
  } catch (err) {
    // Unexpected errors
    if (rawInput) {
      const recoveryPath = await saveRecoveryFile(identifier, rawInput);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        recoveryPath,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printChanges(identifier: string, url: string, changes: Changes): void {
  console.log(`Updated ${identifier}`);
  console.log();

  for (const [field, change] of Object.entries(changes)) {
    console.log(`  ${field}: ${change.to} (was: ${change.from})`);
  }

  console.log();
  console.log(url);
}

function printRecoveryInstructions(
  identifier: string,
  recoveryPath: string
): void {
  console.error();
  console.error('Your input has been saved. To retry:');
  console.error(`  linproj issues edit ${identifier} --recover ${recoveryPath}`);
}

export function createEditCommand(): Command {
  return new Command('edit')
    .description('Edit an existing issue')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--title <title>', 'New title')
    .option('--state <state>', 'New state name')
    .option(
      '--priority <priority>',
      'Priority: urgent, high, medium, low, or none'
    )
    .option('--assignee <assignee>', 'Assignee: email, "me", or "none"')
    .option('--label <label>', 'Set labels (repeatable, replaces all)', collect)
    .option('--project <project>', 'Project name or "none"')
    .option('--team <team>', 'Move to team (team key)')
    .option('--due-date <date>', 'Due date (ISO format) or "none"')
    .option('--estimate <points>', 'Story points estimate')
    .option('-i, --interactive', 'Open in editor')
    .option('--recover <file>', 'Recover from a previous failed edit')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output on success')
    .action(async (identifier: string, options: EditOptions) => {
      const config = await readConfig();

      if (!config.auth) {
        console.error('Error: Not authenticated');
        console.error("Run `linproj auth login` first");
        process.exit(1);
      }

      const client = new LinearClient(config.auth);

      // Fetch the current issue first
      const issue = await getIssue(client, identifier);
      if (!issue) {
        console.error(`Error: Issue '${identifier}' not found`);
        process.exit(1);
      }

      const result = await executeEdit(client, identifier, issue, options);

      // Handle result
      if (!result.success) {
        console.error(`Error: ${result.error}`);
        if (result.recoveryPath) {
          printRecoveryInstructions(identifier, result.recoveryPath);
        }
        process.exit(1);
      }

      if (result.cancelled) {
        console.log('Edit cancelled, no changes made');
        return;
      }

      if (result.noChanges) {
        if (!options.quiet) {
          console.log('No changes to apply');
        }
        return;
      }

      // Output success
      if (options.quiet) {
        return;
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: true,
              issue: result.issue,
              changes: result.changes,
            },
            null,
            2
          )
        );
        return;
      }

      printChanges(result.issue!.identifier, result.issue!.url, result.changes!);
    });
}
