import { describe, it, expect } from 'bun:test';
import { resolvePriority, resolveAssignee, resolveProject } from '../../src/lib/resolve.ts';

// Mock client - not used for tests that return early
const mockClient = {} as any;

describe('resolvePriority', () => {
  it('resolves none to 0', () => {
    expect(resolvePriority('none')).toBe(0);
  });

  it('resolves empty string to 0', () => {
    expect(resolvePriority('')).toBe(0);
  });

  it('resolves urgent to 1', () => {
    expect(resolvePriority('urgent')).toBe(1);
  });

  it('resolves high to 2', () => {
    expect(resolvePriority('high')).toBe(2);
  });

  it('resolves medium to 3', () => {
    expect(resolvePriority('medium')).toBe(3);
  });

  it('resolves low to 4', () => {
    expect(resolvePriority('low')).toBe(4);
  });

  it('resolves numeric strings', () => {
    expect(resolvePriority('0')).toBe(0);
    expect(resolvePriority('1')).toBe(1);
    expect(resolvePriority('2')).toBe(2);
    expect(resolvePriority('3')).toBe(3);
    expect(resolvePriority('4')).toBe(4);
  });

  it('is case-insensitive', () => {
    expect(resolvePriority('HIGH')).toBe(2);
    expect(resolvePriority('Low')).toBe(4);
    expect(resolvePriority('URGENT')).toBe(1);
  });

  it('throws for invalid priority', () => {
    expect(() => resolvePriority('invalid')).toThrow(/Invalid priority/);
  });

  it('throws for out of range numbers', () => {
    expect(() => resolvePriority('5')).toThrow(/Invalid priority/);
    expect(() => resolvePriority('-1')).toThrow(/Invalid priority/);
  });
});

describe('resolveAssignee', () => {
  it('resolves "none" to null', async () => {
    const result = await resolveAssignee(mockClient, 'none');
    expect(result).toBeNull();
  });

  it('resolves empty string to null', async () => {
    const result = await resolveAssignee(mockClient, '');
    expect(result).toBeNull();
  });
});

describe('resolveProject', () => {
  it('resolves "none" to null', async () => {
    const result = await resolveProject(mockClient, 'none');
    expect(result).toBeNull();
  });

  it('resolves empty string to null', async () => {
    const result = await resolveProject(mockClient, '');
    expect(result).toBeNull();
  });
});
