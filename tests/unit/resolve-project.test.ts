import { describe, it, expect } from 'bun:test';
import { resolveProjectForUpdate } from '../../src/lib/resolve.ts';

// Mock client - not used for tests that return early
const mockClient = {} as any;

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
      query: async () => ({
        projects: {
          nodes: [
            { id: 'proj-123', name: 'My Project' },
            { id: 'proj-456', name: 'Another Project' },
          ],
        },
      }),
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
      query: async () => ({
        projects: {
          nodes: [
            { id: 'proj-123', name: 'My Project' },
          ],
        },
      }),
    } as any;

    await expect(
      resolveProjectForUpdate(mockClientWithProjects, 'Nonexistent Project')
    ).rejects.toThrow(/Project 'Nonexistent Project' not found/);
  });

  it('includes available projects in error message', async () => {
    const mockClientWithProjects = {
      query: async () => ({
        projects: {
          nodes: [
            { id: 'proj-123', name: 'Alpha' },
            { id: 'proj-456', name: 'Beta' },
          ],
        },
      }),
    } as any;

    await expect(
      resolveProjectForUpdate(mockClientWithProjects, 'Gamma')
    ).rejects.toThrow(/Available: Alpha, Beta/);
  });

  it('does not treat non-UUID strings as UUIDs', async () => {
    const mockClientWithProjects = {
      query: async () => ({
        projects: {
          nodes: [
            { id: 'proj-123', name: 'Project Name' },
          ],
        },
      }),
    } as any;

    // These look like they could be IDs but aren't valid UUIDs
    const result = await resolveProjectForUpdate(mockClientWithProjects, 'Project Name');
    expect(result).toBe('proj-123');
  });
});
