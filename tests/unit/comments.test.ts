import { describe, test, expect } from 'bun:test';
import { buildCommentTree, type Comment } from '../../src/lib/api.ts';

function makeComment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    body: 'Test comment',
    createdAt: '2026-01-26T10:00:00Z',
    updatedAt: '2026-01-26T10:00:00Z',
    url: 'https://linear.app/test/comment',
    ...overrides,
  };
}

describe('buildCommentTree', () => {
  test('builds flat list into tree', () => {
    const comments: Comment[] = [
      makeComment({ id: '1', body: 'Root', parentId: undefined }),
      makeComment({ id: '2', body: 'Reply', parentId: '1', createdAt: '2026-01-26T11:00:00Z' }),
      makeComment({ id: '3', body: 'Nested reply', parentId: '2', createdAt: '2026-01-26T12:00:00Z' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe('1');
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.id).toBe('2');
    expect(tree[0]!.children[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe('3');
  });

  test('handles multiple root comments', () => {
    const comments: Comment[] = [
      makeComment({ id: '1', body: 'First', parentId: undefined }),
      makeComment({ id: '2', body: 'Second', parentId: undefined, createdAt: '2026-01-26T11:00:00Z' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(2);
    expect(tree[0]!.id).toBe('1');
    expect(tree[1]!.id).toBe('2');
  });

  test('sorts by createdAt', () => {
    const comments: Comment[] = [
      makeComment({ id: '2', body: 'Later', parentId: undefined, createdAt: '2026-01-26T12:00:00Z' }),
      makeComment({ id: '1', body: 'Earlier', parentId: undefined, createdAt: '2026-01-26T10:00:00Z' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree[0]!.id).toBe('1');
    expect(tree[1]!.id).toBe('2');
  });

  test('sorts children by createdAt', () => {
    const comments: Comment[] = [
      makeComment({ id: '1', body: 'Root', parentId: undefined }),
      makeComment({ id: '3', body: 'Later reply', parentId: '1', createdAt: '2026-01-26T12:00:00Z' }),
      makeComment({ id: '2', body: 'Earlier reply', parentId: '1', createdAt: '2026-01-26T11:00:00Z' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree[0]!.children[0]!.id).toBe('2');
    expect(tree[0]!.children[1]!.id).toBe('3');
  });

  test('handles orphaned comments (parent not in list) as roots', () => {
    const comments: Comment[] = [
      makeComment({ id: '1', body: 'Root', parentId: undefined }),
      makeComment({ id: '2', body: 'Orphan', parentId: 'nonexistent', createdAt: '2026-01-26T11:00:00Z' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(2);
    expect(tree[0]!.id).toBe('1');
    expect(tree[1]!.id).toBe('2');
  });

  test('handles empty list', () => {
    const tree = buildCommentTree([]);
    expect(tree).toHaveLength(0);
  });

  test('handles single comment', () => {
    const comments: Comment[] = [
      makeComment({ id: '1', body: 'Only one' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe('1');
    expect(tree[0]!.children).toHaveLength(0);
  });

  test('handles multiple reply levels', () => {
    const comments: Comment[] = [
      makeComment({ id: '1', body: 'Root', parentId: undefined }),
      makeComment({ id: '2', body: 'Reply 1', parentId: '1', createdAt: '2026-01-26T11:00:00Z' }),
      makeComment({ id: '3', body: 'Reply 2', parentId: '1', createdAt: '2026-01-26T12:00:00Z' }),
      makeComment({ id: '4', body: 'Nested under 2', parentId: '2', createdAt: '2026-01-26T13:00:00Z' }),
      makeComment({ id: '5', body: 'Nested under 3', parentId: '3', createdAt: '2026-01-26T14:00:00Z' }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toHaveLength(2);
    expect(tree[0]!.children[0]!.id).toBe('2');
    expect(tree[0]!.children[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe('4');
    expect(tree[0]!.children[1]!.id).toBe('3');
    expect(tree[0]!.children[1]!.children).toHaveLength(1);
    expect(tree[0]!.children[1]!.children[0]!.id).toBe('5');
  });
});
