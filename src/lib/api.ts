import { type Auth, getAuthHeader } from './config.ts';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export class LinearAPIError extends Error {
  constructor(
    message: string,
    public errors?: GraphQLError[],
    public status?: number
  ) {
    super(message);
    this.name = 'LinearAPIError';
  }
}

export class LinearClient {
  private authHeader: string;

  constructor(auth: Auth) {
    this.authHeader = getAuthHeader(auth);
  }

  async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new LinearAPIError(
        `HTTP error: ${response.status} ${response.statusText}`,
        undefined,
        response.status
      );
    }

    const json = (await response.json()) as GraphQLResponse<T>;

    if (json.errors && json.errors.length > 0) {
      const message = json.errors.map((e) => e.message).join('; ');
      throw new LinearAPIError(message, json.errors);
    }

    if (!json.data) {
      throw new LinearAPIError('No data returned from API');
    }

    return json.data;
  }
}

// Query types
export interface User {
  id: string;
  name: string;
  email: string;
}

export type StateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface IssueState {
  name: string;
  type: StateType;
}

export interface IssueLabel {
  name: string;
  color: string;
}

export interface IssueProject {
  name: string;
}

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  state: IssueState;
  priority: number;
  createdAt: string;
  updatedAt: string;
  team?: {
    key: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  labels?: {
    nodes: IssueLabel[];
  };
  project?: IssueProject;
}

// Filter types for querying issues
export interface IssueFilter {
  team?: { key?: { eq: string } };
  state?: { name?: { eq: string }; type?: { eq: StateType } };
  assignee?: { id?: { eq: string }; email?: { eq: string }; null?: boolean };
  project?: { name?: { eq: string } };
  labels?: { name?: { in: string[] } };
  priority?: { eq?: number; in?: number[] };
}

export interface Team {
  id: string;
  name: string;
  key: string;
}

export interface ViewerResponse {
  viewer: User;
}

export interface AssignedIssuesResponse {
  viewer: {
    assignedIssues: {
      nodes: Issue[];
    };
  };
}

export interface TeamsResponse {
  teams: {
    nodes: Team[];
  };
}

export interface CreateIssueResponse {
  issueCreate: {
    success: boolean;
    issue: Issue;
  };
}

export interface DeleteIssueResponse {
  issueDelete: {
    success: boolean;
  };
}

export interface IssueResponse {
  issue: Issue | null;
}

export interface IssuesResponse {
  issues: {
    nodes: Issue[];
  };
}

export interface IssueSearchResponse {
  searchIssues: {
    nodes: Issue[];
  };
}

export interface CreateIssueInput {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
}

// Convenience methods
export async function getViewer(client: LinearClient): Promise<User> {
  const query = `
    query {
      viewer {
        id
        name
        email
      }
    }
  `;
  const result = await client.query<ViewerResponse>(query);
  return result.viewer;
}

export async function getAssignedIssues(
  client: LinearClient,
  first = 50
): Promise<Issue[]> {
  const query = `
    query($first: Int!) {
      viewer {
        assignedIssues(first: $first) {
          nodes {
            id
            identifier
            title
            state {
              name
            }
            priority
            updatedAt
          }
        }
      }
    }
  `;
  const result = await client.query<AssignedIssuesResponse>(query, { first });
  return result.viewer.assignedIssues.nodes;
}

export async function getTeams(client: LinearClient): Promise<Team[]> {
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;
  const result = await client.query<TeamsResponse>(query);
  return result.teams.nodes;
}

export async function createIssue(
  client: LinearClient,
  input: CreateIssueInput
): Promise<Issue> {
  const mutation = `
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          description
          state {
            name
          }
          priority
          updatedAt
        }
      }
    }
  `;
  const result = await client.query<CreateIssueResponse>(mutation, {
    input: {
      teamId: input.teamId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      assigneeId: input.assigneeId,
    },
  });

  if (!result.issueCreate.success) {
    throw new LinearAPIError('Failed to create issue');
  }

  return result.issueCreate.issue;
}

// For integration testing only - not exposed as CLI command
export async function deleteIssue(
  client: LinearClient,
  issueId: string
): Promise<boolean> {
  const mutation = `
    mutation($id: String!) {
      issueDelete(id: $id) {
        success
      }
    }
  `;
  const result = await client.query<DeleteIssueResponse>(mutation, {
    id: issueId,
  });
  return result.issueDelete.success;
}

// Issue fields fragment for consistent field selection
const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  url
  priority
  createdAt
  updatedAt
  state {
    name
    type
  }
  team {
    key
    name
  }
  assignee {
    id
    name
    email
  }
  labels {
    nodes {
      name
      color
    }
  }
  project {
    name
  }
`;

export async function getIssue(
  client: LinearClient,
  identifier: string
): Promise<Issue | null> {
  const query = `
    query($identifier: String!) {
      issue(id: $identifier) {
        ${ISSUE_FIELDS}
      }
    }
  `;
  try {
    const result = await client.query<IssueResponse>(query, { identifier });
    return result.issue;
  } catch (err) {
    // Linear returns an error for nonexistent issues instead of null
    if (err instanceof LinearAPIError && err.message.includes('Entity not found')) {
      return null;
    }
    throw err;
  }
}

export async function listIssues(
  client: LinearClient,
  filter?: IssueFilter,
  first = 50
): Promise<Issue[]> {
  const query = `
    query($first: Int!, $filter: IssueFilter) {
      issues(first: $first, filter: $filter) {
        nodes {
          ${ISSUE_FIELDS}
        }
      }
    }
  `;
  const result = await client.query<IssuesResponse>(query, { first, filter });
  return result.issues.nodes;
}

export async function searchIssues(
  client: LinearClient,
  searchQuery: string,
  filter?: IssueFilter,
  first = 25
): Promise<Issue[]> {
  const query = `
    query($term: String!, $first: Int!, $filter: IssueFilter) {
      searchIssues(term: $term, first: $first, filter: $filter) {
        nodes {
          ${ISSUE_FIELDS}
        }
      }
    }
  `;
  const result = await client.query<IssueSearchResponse>(query, {
    term: searchQuery,
    first,
    filter,
  });
  return result.searchIssues.nodes;
}
