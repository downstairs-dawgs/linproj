import { Auth, getAuthHeader } from './config.ts';

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

export interface IssueState {
  name: string;
}

export interface Issue {
  identifier: string;
  title: string;
  state: IssueState;
  priority: number;
  updatedAt: string;
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
