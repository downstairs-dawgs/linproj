import {
  type LinearClient,
  getWorkflowStates,
  getLabels,
  getUserByEmail,
  getViewer,
  getProjects,
  getTeams,
} from './api.ts';

export async function resolveState(
  client: LinearClient,
  teamId: string,
  stateName: string
): Promise<string> {
  const states = await getWorkflowStates(client, teamId);
  const state = states.find(
    (s) => s.name.toLowerCase() === stateName.toLowerCase()
  );
  if (!state) {
    const names = states.map((s) => s.name).join(', ');
    throw new Error(`State '${stateName}' not found. Available: ${names}`);
  }
  return state.id;
}

export async function resolveLabels(
  client: LinearClient,
  teamId: string,
  labelNames: string[]
): Promise<string[]> {
  if (labelNames.length === 0) {
    return [];
  }

  const labels = await getLabels(client, teamId);
  return labelNames.map((name) => {
    const label = labels.find(
      (l) => l.name.toLowerCase() === name.toLowerCase()
    );
    if (!label) {
      const available = labels.map((l) => l.name).join(', ');
      throw new Error(`Label '${name}' not found. Available: ${available}`);
    }
    return label.id;
  });
}

export async function resolveAssignee(
  client: LinearClient,
  assignee: string
): Promise<string | null> {
  if (assignee === 'none' || assignee === '') {
    return null;
  }
  if (assignee === 'me') {
    const viewer = await getViewer(client);
    return viewer.id;
  }
  const user = await getUserByEmail(client, assignee);
  if (!user) {
    throw new Error(`User '${assignee}' not found`);
  }
  return user.id;
}

export async function resolveProject(
  client: LinearClient,
  projectName: string
): Promise<string | null> {
  if (projectName === 'none' || projectName === '') {
    return null;
  }
  const projects = await getProjects(client);
  const project = projects.find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase()
  );
  if (!project) {
    const available = projects.map((p) => p.name).join(', ');
    throw new Error(`Project '${projectName}' not found. Available: ${available}`);
  }
  return project.id;
}

export async function resolveTeam(
  client: LinearClient,
  teamKey: string
): Promise<string> {
  const teams = await getTeams(client);
  const team = teams.find(
    (t) => t.key.toLowerCase() === teamKey.toLowerCase()
  );
  if (!team) {
    const available = teams.map((t) => t.key).join(', ');
    throw new Error(`Team '${teamKey}' not found. Available: ${available}`);
  }
  return team.id;
}

const PRIORITY_MAP: Record<string, number> = {
  none: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export function resolvePriority(priority: string): number {
  if (priority === '') {
    return 0; // Empty string means no priority
  }
  const lower = priority.toLowerCase();
  if (lower in PRIORITY_MAP) {
    return PRIORITY_MAP[lower]!;
  }
  const num = parseInt(priority, 10);
  if (!isNaN(num) && num >= 0 && num <= 4) {
    return num;
  }
  throw new Error(
    `Invalid priority '${priority}'. Use: none, urgent, high, medium, low, or 0-4`
  );
}
