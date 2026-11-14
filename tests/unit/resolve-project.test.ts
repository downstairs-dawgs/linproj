import { describe, it, expect } from 'bun:test';
import { getProjects } from '../../src/lib/api.ts';
import { resolveProjectForUpdate } from '../../src/lib/resolve.ts';

// Mock client - not used for tests that return early
const mockClient = {} as any;

function singlePage(nodes: { id: string; name: string }[]) {
  return {
    projects: {
      nodes,
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  };
}

// Serves projects in pages of pageSize, keyed by the cursor of the last node
function pagedClient(names: string[], pageSize: number) {
  const projects = names.map((name, i) => ({ id: `proj-${i}`, name }));
  const cursors: (string | null)[] = [];
  const client = {
    query: async (_query: string, variables: { after: string | null }) => {
      cursors.push(variables.after);
      const start = variables.after === null
        ? 0
        : projects.findIndex((p) => p.id === variables.after) + 1;
      const nodes = projects.slice(start, start + pageSize);
      const hasNextPage = start + pageSize < projects.length;
      return {
        projects: {
          nodes,
          pageInfo: { hasNextPage, endCursor: nodes.at(-1)?.id ?? null },
        },
      };
    },
  } as any;
  return { client, cursors };
}

describe('getProjects', () => {
  it('follows pageInfo cursors until the last page', async () => {
    const names = Array.from({ length: 7 }, (_, i) => `Project ${i}`);
    const { client, cursors } = pagedClient(names, 3);

    const projects = await getProjects(client);

    expect(projects.map((p) => p.name)).toEqual(names);
    expect(cursors).toEqual([null, 'proj-2', 'proj-5']);
  });

  it('makes one request when everything fits on one page', async () => {
    const { client, cursors } = pagedClient(['Alpha', 'Beta'], 250);

    const projects = await getProjects(client);

    expect(projects.map((p) => p.name)).toEqual(['Alpha', 'Beta']);
    expect(cursors).toEqual([null]);
  });
});

describe('resolveProjectForUpdate', () => {
  it('passes through valid UUIDs directly', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = await resolveProjectForUpdate(mockClient, uuid);
    expect(result).toBe(uuid);
  });

  it('passes through uppercase UUIDs', async () => {
    const uuid = '550E8400-E29B-41D4-A716-446655440000';
    const result = await resolveProjectForUpdate(mockClient, uuid);
    expect(result).toBe(uuid);
  });

  it('passes through mixed-case UUIDs', async () => {
    const uuid = '550e8400-E29B-41d4-A716-446655440000';
    const result = await resolveProjectForUpdate(mockClient, uuid);
    expect(result).toBe(uuid);
  });

  it('resolves project name to ID (case-insensitive)', async () => {
    const mockClientWithProjects = {
      query: async () => singlePage([
        { id: 'proj-123', name: 'My Project' },
        { id: 'proj-456', name: 'Another Project' },
      ]),
    } as any;

    // Exact match
    const result1 = await resolveProjectForUpdate(mockClientWithProjects, 'My Project');
    expect(result1).toBe('proj-123');

    // Case-insensitive match
    const result2 = await resolveProjectForUpdate(mockClientWithProjects, 'my project');
    expect(result2).toBe('proj-123');

    const result3 = await resolveProjectForUpdate(mockClientWithProjects, 'MY PROJECT');
    expect(result3).toBe('proj-123');
  });

  it('throws error when project not found', async () => {
    const mockClientWithProjects = {
      query: async () => singlePage([
        { id: 'proj-123', name: 'My Project' },
      ]),
    } as any;

    await expect(
      resolveProjectForUpdate(mockClientWithProjects, 'Nonexistent Project')
    ).rejects.toThrow(/Project 'Nonexistent Project' not found/);
  });

  it('resolves a project that is not on the first page', async () => {
    const names = Array.from({ length: 300 }, (_, i) => `Project ${i}`);
    const { client } = pagedClient(names, 250);

    const result = await resolveProjectForUpdate(client, 'project 260');
    expect(result).toBe('proj-260');
  });

  it('includes available projects in error message', async () => {
    const mockClientWithProjects = {
      query: async () => singlePage([
        { id: 'proj-123', name: 'Alpha' },
        { id: 'proj-456', name: 'Beta' },
      ]),
    } as any;

    await expect(
      resolveProjectForUpdate(mockClientWithProjects, 'Gamma')
    ).rejects.toThrow(/Available: Alpha, Beta/);
  });
});
