# Issue Queries: Get, Search, and List Filters

**Date:** 2026-01-23
**Goal:** Enable users to find, view, and filter issues effectively

## Overview

This design covers three related features that complete the "find and view" workflow:

1. **Get** - Retrieve a single issue by identifier (e.g., `PROJ-123`)
2. **Search** - Find issues by text query across title/description
3. **List Filters** - Extend `issues list` with filters for team, state, assignee, etc.

These features share common infrastructure (expanded Issue type, filter types) and are designed together for consistency.

---

## 1. Get Issue

Retrieve and display a single issue by its identifier.

### CLI Interface

```bash
# Get issue by identifier
linproj issues get PROJ-123

# Get issue and output specific field (for scripting)
linproj issues get PROJ-123 --field url
linproj issues get PROJ-123 --field id

# Output as JSON
linproj issues get PROJ-123 --json
```

### Output Format

**Default (human-readable):**
```
PROJ-123: Fix login timeout issue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

State:     In Progress
Priority:  High
Team:      Engineering (ENG)
Assignee:  Jane Doe
Labels:    bug, backend
Project:   Q1 Stability
Created:   2026-01-20
Updated:   2026-01-23

Description:
Users are experiencing timeout errors when logging in during peak hours.
This appears to be related to the session validation query.

URL: https://linear.app/myworkspace/issue/PROJ-123
```

**JSON output (`--json`):**
```json
{
  "id": "abc123",
  "identifier": "PROJ-123",
  "title": "Fix login timeout issue",
  "description": "Users are experiencing timeout errors...",
  "state": { "name": "In Progress", "type": "started" },
  "priority": 2,
  "team": { "key": "ENG", "name": "Engineering" },
  "assignee": { "name": "Jane Doe", "email": "jane@example.com" },
  "labels": [{ "name": "bug" }, { "name": "backend" }],
  "project": { "name": "Q1 Stability" },
  "url": "https://linear.app/myworkspace/issue/PROJ-123",
  "createdAt": "2026-01-20T10:00:00Z",
  "updatedAt": "2026-01-23T14:30:00Z"
}
```

**Single field (`--field`):**
```bash
$ linproj issues get PROJ-123 --field url
https://linear.app/myworkspace/issue/PROJ-123

$ linproj issues get PROJ-123 --field id
abc123
```

### GraphQL Query

```graphql
query($identifier: String!) {
  issue(id: $identifier) {
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
  }
}
```

Note: Linear's `issue(id:)` query accepts either the internal UUID or the human-readable identifier (e.g., "PROJ-123").

### Implementation

**New file:** `src/commands/issues/get.ts`

```typescript
export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a single issue by identifier')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--json', 'Output as JSON')
    .option('--field <field>', 'Output a single field (id, url, state, etc.)')
    .action(async (identifier, options) => {
      // Implementation
    });
}
```

**New API function:** `getIssue(client, identifier)` in `src/lib/api.ts`

---

## 2. Search Issues

Find issues by text query.

### CLI Interface

```bash
# Search by text (searches title and description)
linproj issues search "login timeout"

# Search with filters
linproj issues search "login" --team ENG
linproj issues search "login" --state "In Progress"
linproj issues search "login" --assignee me    # Filter to issues assigned to me

# Limit results
linproj issues search "login" --limit 10

# Output as JSON
linproj issues search "login" --json
```

### Output Format

Uses the same table format as `issues list`:

```
ID        STATE        PRIORITY  TITLE
PROJ-123  In Progress  High      Fix login timeout issue
PROJ-089  Backlog      Medium    Login page redesign
PROJ-045  Done         Low       Update login documentation

Found 3 issues matching "login"
```

### GraphQL Query

Linear provides an `issueSearch` query for full-text search:

```graphql
query($query: String!, $first: Int!, $filter: IssueFilter) {
  issueSearch(query: $query, first: $first, filter: $filter) {
    nodes {
      id
      identifier
      title
      state { name }
      priority
      updatedAt
    }
  }
}
```

The `filter` parameter accepts the same `IssueFilter` type used for list filtering (see below).

### Implementation

**New file:** `src/commands/issues/search.ts`

```typescript
export function createSearchCommand(): Command {
  return new Command('search')
    .description('Search for issues by text')
    .argument('<query>', 'Search query')
    .option('-t, --team <team>', 'Filter by team key')
    .option('-s, --state <state>', 'Filter by state name')
    .option('-a, --assignee <assignee>', 'Filter by assignee (use "me" for yourself)')
    .option('-n, --limit <number>', 'Maximum results', '25')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      // Implementation
    });
}
```

**New API function:** `searchIssues(client, query, filter?, first?)` in `src/lib/api.ts`

---

## 3. List Filters

Extend `issues list` to support filtering.

### CLI Interface

```bash
# List all issues (no default filter)
linproj issues list

# Filter by team (required in most cases to avoid huge result sets)
linproj issues list --team ENG
linproj issues list -t ENG

# Filter by state (use Linear's state names or types)
linproj issues list --state "In Progress"
linproj issues list --state-type started      # Filter by state type
linproj issues list --state-type unstarted

# Filter by assignee
linproj issues list --assignee me
linproj issues list --assignee jane@example.com
linproj issues list --assignee none           # Unassigned issues

# Filter by project
linproj issues list --project "Q1 Stability"

# Filter by label
linproj issues list --label bug
linproj issues list --label bug --label backend  # Multiple labels (AND)

# Filter by priority (use Linear's values: 0-4 or urgent/high/medium/low/none)
linproj issues list --priority urgent
linproj issues list --priority 1,2            # Multiple priorities (OR)

# Combine filters
linproj issues list --team ENG --state "In Progress" --priority high

# Output options
linproj issues list --json
linproj issues list --limit 100
```

### Filter Values

Use Linear's terminology directly:

**State types** (via `--state-type`):
- `backlog` - Issues in backlog
- `unstarted` - Issues not yet started
- `started` - Issues in progress
- `completed` - Completed issues
- `canceled` - Canceled issues

**Priority** (via `--priority`):
- `none` or `0` - No priority
- `urgent` or `1` - Urgent
- `high` or `2` - High
- `medium` or `3` - Medium
- `low` or `4` - Low

**Assignee** (via `--assignee`):
- `me` - Current authenticated user
- `none` - Unassigned issues
- `<email>` - Specific user by email

### GraphQL Query

Replace the current `viewer.assignedIssues` query with the more flexible `issues` query:

```graphql
query($first: Int!, $filter: IssueFilter) {
  issues(first: $first, filter: $filter) {
    nodes {
      id
      identifier
      title
      state { name }
      priority
      updatedAt
    }
  }
}
```

**IssueFilter structure:**
```graphql
input IssueFilter {
  team: TeamFilter
  state: WorkflowStateFilter
  assignee: UserFilter
  project: ProjectFilter
  labels: LabelFilter
  priority: NumberComparator
  and: [IssueFilter!]
  or: [IssueFilter!]
}
```

### Implementation Changes

**Modify:** `src/commands/issues/list.ts`

```typescript
export function createListCommand(): Command {
  return new Command('list')
    .description('List issues')
    .option('-t, --team <team>', 'Filter by team key')
    .option('-s, --state <state>', 'Filter by state name')
    .option('--state-type <type>', 'Filter by state type (backlog, unstarted, started, completed, canceled)')
    .option('-a, --assignee <assignee>', 'Filter by assignee (me, none, or email)')
    .option('-p, --project <project>', 'Filter by project name')
    .option('-l, --label <label...>', 'Filter by label(s)')
    .option('--priority <priority>', 'Filter by priority (urgent, high, medium, low, none, or 0-4)')
    .option('-n, --limit <number>', 'Maximum results', '50')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      // Build filter object from options
    });
}
```

**New API function:** `listIssues(client, filter?, first?)` in `src/lib/api.ts`

---

## Shared Infrastructure

### Extended Issue Type

Expand the `Issue` interface to include all fields we might display or filter on:

```typescript
export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  state: {
    name: string;
    type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  };
  team?: {
    key: string;
    name: string;
  };
  assignee?: {
    name: string;
    email: string;
  };
  labels?: {
    nodes: Array<{ name: string; color: string }>;
  };
  project?: {
    name: string;
  };
}
```

### Filter Builder

Create a utility to build `IssueFilter` objects from CLI options:

```typescript
// src/lib/filters.ts

export interface ListOptions {
  team?: string;
  state?: string;
  stateType?: string;
  assignee?: string;
  project?: string;
  label?: string[];
  priority?: string;
}

export async function buildIssueFilter(
  client: LinearClient,
  options: ListOptions
): Promise<IssueFilter> {
  const filter: IssueFilter = {};

  if (options.team) {
    filter.team = { key: { eq: options.team } };
  }

  if (options.state) {
    filter.state = { name: { eq: options.state } };
  }

  if (options.stateType) {
    filter.state = { type: { eq: options.stateType } };
  }

  if (options.assignee) {
    if (options.assignee === 'me') {
      const viewer = await getViewer(client);
      filter.assignee = { id: { eq: viewer.id } };
    } else if (options.assignee === 'none') {
      filter.assignee = { null: true };
    } else {
      // Look up user by email
      filter.assignee = { email: { eq: options.assignee } };
    }
  }

  if (options.priority) {
    const priorityValue = parsePriority(options.priority);
    filter.priority = { eq: priorityValue };
  }

  // ... other filters

  return filter;
}

function parsePriority(value: string): number {
  const map: Record<string, number> = {
    none: 0, urgent: 1, high: 2, medium: 3, low: 4
  };
  return map[value.toLowerCase()] ?? parseInt(value, 10);
}
```

### JSON Output Flag

Add consistent `--json` support across all commands that output issues:

```typescript
// src/lib/output.ts

export function outputIssues(issues: Issue[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(issues, null, 2));
  } else {
    printIssuesTable(issues);
  }
}

export function outputIssue(issue: Issue, json: boolean, field?: string): void {
  if (field) {
    // Extract and print single field
    const value = getFieldValue(issue, field);
    console.log(value);
  } else if (json) {
    console.log(JSON.stringify(issue, null, 2));
  } else {
    printIssueDetails(issue);
  }
}
```

---

## Implementation Order

### Step 1: Extend Issue Type and API
- [ ] Expand `Issue` interface with all fields
- [ ] Add `getIssue(client, identifier)` function
- [ ] Add `listIssues(client, filter, first)` function
- [ ] Add `searchIssues(client, query, filter, first)` function

### Step 2: Implement Get Command
- [ ] Create `src/commands/issues/get.ts`
- [ ] Support `--json` and `--field` options
- [ ] Register in `src/commands/issues/index.ts`
- [ ] Add tests

### Step 3: Implement Search Command
- [ ] Create `src/commands/issues/search.ts`
- [ ] Build filter from CLI options
- [ ] Register in `src/commands/issues/index.ts`
- [ ] Add tests

### Step 4: Add Filters to List Command
- [ ] Create `src/lib/filters.ts` for filter building
- [ ] Modify `list.ts` to use new `listIssues` with filters
- [ ] Support priority name-to-number conversion
- [ ] Add tests

### Step 5: Output Utilities
- [ ] Create `src/lib/output.ts`
- [ ] Add `--json` support to list and search
- [ ] Add `--field` support to get

---

## Testing

All tests use Polly.js for HTTP record/replay. Tests should be added to `tests/integration/`.

### Test Structure

```typescript
// tests/integration/issues-get.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { setupPolly } from '../setup';

describe('issues get', () => {
  const polly = setupPolly('issues-get');

  afterAll(() => polly.stop());

  test('retrieves issue by identifier', async () => {
    const client = new LinearClient(testAuth);
    const issue = await getIssue(client, 'TEST-123');

    expect(issue.identifier).toBe('TEST-123');
    expect(issue.title).toBeDefined();
    expect(issue.url).toContain('linear.app');
  });

  test('returns null for nonexistent issue', async () => {
    const client = new LinearClient(testAuth);
    const issue = await getIssue(client, 'NONEXISTENT-999');

    expect(issue).toBeNull();
  });
});
```

```typescript
// tests/integration/issues-search.test.ts
describe('issues search', () => {
  const polly = setupPolly('issues-search');

  afterAll(() => polly.stop());

  test('finds issues matching query', async () => {
    const client = new LinearClient(testAuth);
    const issues = await searchIssues(client, 'test query');

    expect(Array.isArray(issues)).toBe(true);
  });

  test('returns empty array for no matches', async () => {
    const client = new LinearClient(testAuth);
    const issues = await searchIssues(client, 'xyznonexistent123');

    expect(issues).toEqual([]);
  });

  test('respects team filter', async () => {
    const client = new LinearClient(testAuth);
    const issues = await searchIssues(client, 'test', { team: { key: { eq: 'ENG' } } });

    for (const issue of issues) {
      expect(issue.team?.key).toBe('ENG');
    }
  });
});
```

```typescript
// tests/integration/issues-list.test.ts
describe('issues list', () => {
  const polly = setupPolly('issues-list');

  afterAll(() => polly.stop());

  test('lists issues without filter', async () => {
    const client = new LinearClient(testAuth);
    const issues = await listIssues(client, {}, 10);

    expect(Array.isArray(issues)).toBe(true);
  });

  test('filters by team', async () => {
    const client = new LinearClient(testAuth);
    const issues = await listIssues(client, { team: { key: { eq: 'ENG' } } }, 10);

    for (const issue of issues) {
      expect(issue.team?.key).toBe('ENG');
    }
  });

  test('filters by state type', async () => {
    const client = new LinearClient(testAuth);
    const issues = await listIssues(client, { state: { type: { eq: 'started' } } }, 10);

    for (const issue of issues) {
      expect(issue.state.type).toBe('started');
    }
  });

  test('filters by assignee', async () => {
    const client = new LinearClient(testAuth);
    const viewer = await getViewer(client);
    const issues = await listIssues(client, { assignee: { id: { eq: viewer.id } } }, 10);

    for (const issue of issues) {
      expect(issue.assignee?.email).toBe(viewer.email);
    }
  });
});
```

### Recording New Tests

```bash
# Record all fixtures (requires valid LINEAR_API_KEY)
POLLY_MODE=record bun test

# Run tests using recorded fixtures
bun test

# Record only missing fixtures
POLLY_MODE=record_missing bun test
```

### Test Coverage Requirements

Each new API function must have tests covering:
- Happy path (valid input, expected output)
- Edge cases (empty results, missing optional fields)
- Error cases (not found, invalid input)

---

## Error Handling

| Scenario | Error Message |
|----------|---------------|
| Issue not found | `Error: Issue 'PROJ-999' not found` |
| Invalid team key | `Error: Team 'XYZ' not found` |
| Invalid state name | `Error: State 'invalid' not found. Valid states: Todo, In Progress, Done, ...` |
| Invalid field name | `Error: Unknown field 'foo'. Valid fields: id, url, state, priority, ...` |
| No search results | `No issues found matching "query"` (exit 0, not an error) |

---

## Future Considerations

- **Pagination**: Add `--cursor` or `--page` for paginated results
- **Sort order**: Add `--sort` flag (updatedAt, createdAt, priority)
- **Output format**: Consider `--format=csv` for spreadsheet export
- **Saved filters**: Allow saving filter combinations as named presets
