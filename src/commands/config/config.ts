import { Command } from 'commander';
import {
  getCurrentWorkspace,
  writeWorkspace,
  ensureV2Config,
  type WorkspaceProfile,
} from '../../lib/config.ts';
import { LinearClient, getProjects, getTeams } from '../../lib/api.ts';

const CONFIG_KEYS = ['default-team', 'default-project'] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

function requireConfigKey(key: string): ConfigKey {
  if (!(CONFIG_KEYS as readonly string[]).includes(key)) {
    console.error(`Error: Unknown config key '${key}'`);
    console.error(`Supported keys: ${CONFIG_KEYS.join(', ')}`);
    process.exit(1);
  }
  return key as ConfigKey;
}

function requireNoEnvAuth(): void {
  if (process.env.LINEAR_API_KEY) {
    console.error('Error: LINEAR_API_KEY environment variable is set.');
    console.error('Unset it to manage workspace configuration.');
    process.exit(1);
  }
}

async function requireV2Config(): Promise<void> {
  try {
    await ensureV2Config();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a config value for the current workspace')
    .argument('<key>', `Config key to get (supported: ${CONFIG_KEYS.join(', ')})`)
    .action(async (key: string) => {
      requireNoEnvAuth();
      await requireV2Config();
      const configKey = requireConfigKey(key);

      try {
        const workspace = await getCurrentWorkspace();
        const value = configKey === 'default-team'
          ? workspace.defaultTeam
          : workspace.defaultProject;
        if (value) {
          console.log(value);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

export function createSetCommand(): Command {
  return new Command('set')
    .description('Set a config value for the current workspace (use empty value to clear)')
    .argument('<key>', `Config key to set (supported: ${CONFIG_KEYS.join(', ')})`)
    .argument('<value>', 'Value to set (use "" to clear)')
    .addHelpText('after', `
Keys:
  default-team     Team key used when --team is not given
  default-project  Project name used by \`issues create\` when --project is not given.
                   The name must match an existing project (case-insensitive).`)
    .action(async (key: string, value: string) => {
      requireNoEnvAuth();
      await requireV2Config();
      const configKey = requireConfigKey(key);

      try {
        const workspace = await getCurrentWorkspace();
        if (configKey === 'default-project') {
          await setDefaultProject(workspace, value);
          return;
        }

        // Empty value clears the setting
        if (value === '') {
          delete workspace.defaultTeam;
          await writeWorkspace(workspace);
          console.log('Default team cleared');
          return;
        }

        const client = new LinearClient(workspace.auth);
        const teams = await getTeams(client);
        const team = teams.find((t) => t.key === value);

        if (!team) {
          console.error(`Error: Team '${value}' not found.`);
          console.error('');
          console.error('Available teams:');
          for (const t of teams) {
            console.error(`  ${t.key} - ${t.name}`);
          }
          process.exit(1);
        }

        workspace.defaultTeam = value;
        await writeWorkspace(workspace);
        console.log(`Default team set to: ${value}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}

async function setDefaultProject(workspace: WorkspaceProfile, value: string): Promise<void> {
  if (value === '') {
    delete workspace.defaultProject;
    await writeWorkspace(workspace);
    console.log('Default project cleared');
    return;
  }

  const client = new LinearClient(workspace.auth);
  const projects = await getProjects(client);
  const project = projects.find(
    (p) => p.name.toLowerCase() === value.toLowerCase()
  );

  if (!project) {
    console.error(`Error: Project '${value}' not found.`);
    console.error('Run `linproj projects list` to see available projects.');
    process.exit(1);
  }

  // Store Linear's spelling of the name, not whatever case was typed
  workspace.defaultProject = project.name;
  await writeWorkspace(workspace);
  console.log(`Default project set to: ${project.name}`);
}
