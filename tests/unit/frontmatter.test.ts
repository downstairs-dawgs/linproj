import { describe, it, expect } from 'bun:test';
import {
  parseFrontmatter,
  renderFrontmatter,
  FrontmatterError,
} from '../../src/lib/frontmatter.ts';
import type { Issue } from '../../src/lib/api.ts';

describe('parseFrontmatter', () => {
  it('parses frontmatter with description', () => {
    const input = `---
title: 'New title'
priority: high
---

Description here.`;

    const result = parseFrontmatter(input);
    expect(result.fields.title).toBe('New title');
    expect(result.fields.priority).toBe('high');
    expect(result.description).toBe('Description here.');
  });

  it('parses frontmatter only (no description)', () => {
    const input = `---
title: 'New title'
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.title).toBe('New title');
    expect(result.description).toBeUndefined();
  });

  it('parses description only (no frontmatter)', () => {
    const input = 'Just a description';

    const result = parseFrontmatter(input);
    expect(result.fields).toEqual({});
    expect(result.description).toBe('Just a description');
  });

  it('handles empty frontmatter', () => {
    const input = `---
---

Description only.`;

    const result = parseFrontmatter(input);
    expect(result.fields).toEqual({});
    expect(result.description).toBe('Description only.');
  });

  it('parses labels array', () => {
    const input = `---
labels:
  - bug
  - urgent
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.labels).toEqual(['bug', 'urgent']);
  });

  it('rejects description in frontmatter', () => {
    const input = `---
title: 'New title'
description: 'Not allowed'
---`;

    expect(() => parseFrontmatter(input)).toThrow(
      "Use the body for description, not the 'description' field"
    );
  });

  it('ignores comments in frontmatter', () => {
    const input = `---
# This is a comment
title: 'New title'
# Another comment
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.title).toBe('New title');
  });

  it('rejects unknown fields', () => {
    const input = `---
title: 'Valid'
unknownField: 'Invalid'
---`;

    expect(() => parseFrontmatter(input)).toThrow(/Unknown field 'unknownField'/);
  });

  it('validates title is non-empty', () => {
    const input = `---
title: ''
---`;

    expect(() => parseFrontmatter(input)).toThrow('Title cannot be empty');
  });

  it('validates title is a string', () => {
    const input = `---
title: 123
---`;

    expect(() => parseFrontmatter(input)).toThrow("Field 'title' must be a string");
  });

  it('validates priority values', () => {
    const input = `---
priority: invalid
---`;

    expect(() => parseFrontmatter(input)).toThrow(/Invalid priority 'invalid'/);
  });

  it('accepts valid priority values (case-insensitive)', () => {
    const priorities = ['none', 'URGENT', 'High', 'medium', 'LOW'];
    for (const p of priorities) {
      const input = `---
priority: ${p}
---`;
      const result = parseFrontmatter(input);
      expect(result.fields.priority as string).toBe(p);
    }
  });

  it('validates labels is an array', () => {
    const input = `---
labels: 'not-an-array'
---`;

    expect(() => parseFrontmatter(input)).toThrow("Field 'labels' must be an array");
  });

  it('validates each label is a string', () => {
    const input = `---
labels:
  - valid
  - 123
---`;

    expect(() => parseFrontmatter(input)).toThrow('Each label must be a string');
  });

  it('validates estimate is a number', () => {
    const input = `---
estimate: 'not-a-number'
---`;

    expect(() => parseFrontmatter(input)).toThrow("Field 'estimate' must be a number");
  });

  it('accepts valid estimate numbers', () => {
    const input = `---
estimate: 5
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.estimate).toBe(5);
  });

  it('validates dueDate format', () => {
    const input = `---
dueDate: 'invalid-date'
---`;

    expect(() => parseFrontmatter(input)).toThrow(/Invalid dueDate/);
  });

  it('accepts valid ISO date for dueDate', () => {
    const input = `---
dueDate: '2026-02-15'
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.dueDate).toBe('2026-02-15');
  });

  it('accepts "none" for dueDate', () => {
    const input = `---
dueDate: none
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.dueDate).toBe('none');
  });

  it('handles empty labels array', () => {
    const input = `---
labels: []
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.labels).toEqual([]);
  });

  it('parses all supported fields', () => {
    const input = `---
title: 'Test Issue'
state: 'In Progress'
priority: high
assignee: user@example.com
labels:
  - bug
  - frontend
project: 'Q1 Goals'
team: ENG
dueDate: '2026-03-01'
estimate: 3
---

Full description here.`;

    const result = parseFrontmatter(input);
    expect(result.fields).toEqual({
      title: 'Test Issue',
      state: 'In Progress',
      priority: 'high',
      assignee: 'user@example.com',
      labels: ['bug', 'frontend'],
      project: 'Q1 Goals',
      team: 'ENG',
      dueDate: '2026-03-01',
      estimate: 3,
    });
    expect(result.description).toBe('Full description here.');
  });

  it('handles whitespace-only body as clearing description', () => {
    const input = `---
title: 'Test'
---

`;

    const result = parseFrontmatter(input);
    expect(result.fields.title).toBe('Test');
    expect(result.description).toBeUndefined();
  });

  it('throws FrontmatterError for invalid YAML', () => {
    const input = `---
title: [invalid yaml
---`;

    expect(() => parseFrontmatter(input)).toThrow(FrontmatterError);
    expect(() => parseFrontmatter(input)).toThrow(/Invalid YAML/);
  });

  it('preserves multiline description', () => {
    const input = `---
title: 'Test'
---

Line 1

Line 2

- Bullet 1
- Bullet 2`;

    const result = parseFrontmatter(input);
    expect(result.description).toBe(`Line 1

Line 2

- Bullet 1
- Bullet 2`);
  });
});

describe('renderFrontmatter', () => {
  const baseIssue: Issue = {
    id: 'issue-123',
    identifier: 'PROJ-456',
    title: 'Test Issue Title',
    description: 'Issue description here.',
    url: 'https://linear.app/team/issue/PROJ-456',
    state: { name: 'In Progress', type: 'started' },
    priority: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    team: { key: 'PROJ', name: 'Project Team' },
    assignee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
    labels: { nodes: [{ name: 'bug', color: '#ff0000' }] },
    project: { name: 'Q1 Goals' },
  };

  it('renders issue as frontmatter with description', () => {
    const result = renderFrontmatter(baseIssue);

    expect(result).toContain('---');
    expect(result).toContain("title: 'Test Issue Title'");
    expect(result).toContain("state: 'In Progress'");
    expect(result).toContain('priority: high');
    expect(result).toContain('assignee: jane@example.com');
    expect(result).toContain('  - bug');
    expect(result).toContain("project: 'Q1 Goals'");
    expect(result).toContain('Issue description here.');
  });

  it('renders issue without assignee', () => {
    const issue = { ...baseIssue, assignee: undefined };
    const result = renderFrontmatter(issue);

    expect(result).toContain('assignee: none');
  });

  it('renders issue without labels', () => {
    const issue = { ...baseIssue, labels: { nodes: [] } };
    const result = renderFrontmatter(issue);

    expect(result).toContain('labels: []');
  });

  it('renders issue without project', () => {
    const issue = { ...baseIssue, project: undefined };
    const result = renderFrontmatter(issue);

    expect(result).not.toContain('project:');
  });

  it('renders issue without description', () => {
    const issue = { ...baseIssue, description: undefined };
    const result = renderFrontmatter(issue);

    // Should end after the closing ---
    const lines = result.split('\n');
    const lastContentLine = lines.filter((l) => l.trim()).pop();
    expect(lastContentLine).toBe('---');
  });

  it('escapes single quotes in title', () => {
    const issue = { ...baseIssue, title: "Issue with 'quotes'" };
    const result = renderFrontmatter(issue);

    expect(result).toContain("title: 'Issue with ''quotes'''");
  });

  it('includes helpful comments', () => {
    const result = renderFrontmatter(baseIssue);

    expect(result).toContain('# Editing PROJ-456');
    expect(result).toContain("# Delete fields you don't want to change");
    expect(result).toContain('# Save and close to apply changes');
  });

  it('renders all priority levels correctly', () => {
    const priorities = [
      { value: 0, name: 'none' },
      { value: 1, name: 'urgent' },
      { value: 2, name: 'high' },
      { value: 3, name: 'medium' },
      { value: 4, name: 'low' },
    ];

    for (const { value, name } of priorities) {
      const issue = { ...baseIssue, priority: value };
      const result = renderFrontmatter(issue);
      expect(result).toContain(`priority: ${name}`);
    }
  });
});
