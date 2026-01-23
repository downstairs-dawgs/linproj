# Issue Edit: Modify Existing Issues

**Date:** 2026-01-23
**Goal:** Enable editing of existing issues via CLI, optimized for AI agent workflows

## Overview

This design covers the `issues edit` command, which allows modifying existing Linear issues. The primary use case is AI agents (e.g., Claude Code) programmatically updating issues, with secondary support for human CLI users.

**Design principles:**
1. **AI-first**: Optimize for programmatic use over human ergonomics
2. **Single composable format**: YAML frontmatter for structured fields, markdown body for description
3. **Partial updates**: Only specified fields are modified
4. **Multiple input modes**: Piped stdin, flags, and interactive editor

---

## CLI Interface

### Piped Input (Primary - AI Agents)

The primary interface accepts YAML frontmatter via stdin:

```bash
# Update title only
cat <<EOF | linproj issues edit PROJ-123
---
title: 'New title for the issue'
---
EOF

# Update multiple fields
cat <<EOF | linproj issues edit PROJ-123
---
title: 'Fix authentication timeout'
state: 'In Progress'
priority: high
assignee: jane@example.com
---
EOF

# Update description (body after frontmatter)
cat <<EOF | linproj issues edit PROJ-123
---
title: 'Fix authentication timeout'
---

Updated description with more context.

## Steps to reproduce
1. Log in during peak hours
2. Observe timeout after 30 seconds

**Note:** This is markdown.
EOF

# Update only description (empty frontmatter or no frontmatter)
cat <<EOF | linproj issues edit PROJ-123
New description, replacing the old one entirely.
EOF
```

### Flag-Based Input (Quick Edits)

For simple single-field updates:

```bash
# Update single fields
linproj issues edit PROJ-123 --title "New title"
linproj issues edit PROJ-123 --state "In Progress"
linproj issues edit PROJ-123 --assignee jane@example.com
linproj issues edit PROJ-123 --assignee me
linproj issues edit PROJ-123 --assignee none
linproj issues edit PROJ-123 --priority high
linproj issues edit PROJ-123 --priority 2

# Labels (replaces all existing labels)
linproj issues edit PROJ-123 --label bug
linproj issues edit PROJ-123 --label bug --label urgent
linproj issues edit PROJ-123 --label ''  # Remove all labels

# Multiple fields
linproj issues edit PROJ-123 --state "Done" --assignee none

# Output options
linproj issues edit PROJ-123 --title "New" --json
linproj issues edit PROJ-123 --title "New" --quiet
```

### Interactive Mode (Human Users)

Opens `$EDITOR` with current issue data pre-populated:

```bash
# Opens editor with issue in frontmatter format
linproj issues edit PROJ-123

# Explicitly request interactive mode
linproj issues edit PROJ-123 --interactive
linproj issues edit PROJ-123 -i
```

The editor opens with:

```yaml
---
# Editing PROJ-123
# Delete fields you don't want to change
# Save and close to apply changes, or delete everything to cancel

title: 'Current issue title'
state: 'In Progress'
priority: high
assignee: jane@example.com
labels:
  - bug
  - backend
project: 'Q1 Stability'
---

Current description text goes here.

It preserves all existing markdown formatting.
```

---

## Input Format Specification

### YAML Frontmatter

The frontmatter is delimited by `---` at the start and end:

```yaml
---
field: value
---
```

**Parsing rules:**
1. Frontmatter must start at the beginning of input (no leading whitespace/newlines before first `---`)
2. Everything after the closing `---` is the description (optional)
3. If no `---` delimiters, entire input is treated as description
4. Empty frontmatter (`---\n---`) is valid (updates only description)
5. Comments in frontmatter (lines starting with `#`) are ignored

### Supported Fields

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `title` | string | Any text | Required non-empty if specified |
| `state` | string | State name (e.g., "In Progress", "Done") | Looked up by name |
| `priority` | string/int | `none`/`0`, `urgent`/`1`, `high`/`2`, `medium`/`3`, `low`/`4` | |
| `assignee` | string | `me`, `none`, or email address | `none` unassigns |
| `labels` | array | List of label names (replaces all) | |
| `project` | string | Project name or `none` | `none` removes from project |
| `team` | string | Team key (e.g., "ENG") | Moves issue to different team |
| `dueDate` | string | ISO date (e.g., "2026-02-15") or `none` | |
| `estimate` | number | Story points (depends on team settings) | |

### Label Syntax

Labels always replace all existing labels with the provided list:

```yaml
labels:
  - bug
  - backend
```

To remove all labels, use an empty array:

```yaml
labels: []
```

### Description

Everything after the closing `---` is the new description:

```yaml
---
title: 'New title'
---

This becomes the description.
Markdown is **supported**.
```

**Rules:**
- If nothing after `---`, description is not modified
- To clear the description, provide empty body (whitespace-only after `---`)
- `description` field in frontmatter is **not allowed** - use the body instead. The command will error if `description` appears in frontmatter.

---

## Output Format

### Default (Success)

```
✓ Updated PROJ-123

  title:    Fix authentication timeout (was: Auth bug)
  state:    In Progress (was: Backlog)
  priority: High (was: None)

https://linear.app/myworkspace/issue/PROJ-123
```

Only changed fields are shown in the diff output.

### JSON Output (`--json`)

```json
{
  "success": true,
  "issue": {
    "id": "abc123",
    "identifier": "PROJ-123",
    "title": "Fix authentication timeout",
    "state": { "name": "In Progress", "type": "started" },
    "priority": 2,
    ...
  },
  "changes": {
    "title": { "from": "Auth bug", "to": "Fix authentication timeout" },
    "state": { "from": "Backlog", "to": "In Progress" },
    "priority": { "from": 0, "to": 2 }
  }
}
```

### Quiet Mode (`--quiet`)

No output on success (exit 0). Errors still print to stderr.

---

## GraphQL Mutation

```graphql
mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue {
      id
      identifier
      title
      description
      url
      priority
      createdAt
      updatedAt
      state { id name type }
      team { key name }
      assignee { id name email }
      labels { nodes { id name color } }
      project { id name }
    }
  }
}
```

**IssueUpdateInput fields:**
- `title: String`
- `description: String`
- `stateId: String` - Workflow state UUID (looked up from name)
- `priority: Int` - 0-4
- `assigneeId: String` - User UUID or null to unassign
- `labelIds: [String!]` - Label UUIDs (replaces all)
- `projectId: String` - Project UUID or null to remove
- `teamId: String` - Team UUID (for moving between teams)
- `dueDate: TimelessDate` - ISO date string
- `estimate: Float` - Story points

### Label Updates

Labels are always replaced in full. The workflow is:

1. Look up label IDs by name (via team's available labels)
2. Send full `labelIds` array in mutation

This avoids the complexity of incremental updates and makes the behavior predictable.

---

## Implementation

### New Files

**`src/commands/issues/edit.ts`**

```typescript
export function createEditCommand(): Command {
  return new Command('edit')
    .description('Edit an existing issue')
    .argument('<identifier>', 'Issue identifier (e.g., PROJ-123)')
    .option('--title <title>', 'New title')
    .option('--state <state>', 'New state name')
    .option('--priority <priority>', 'Priority: urgent/high/medium/low/none or 0-4')
    .option('--assignee <assignee>', 'Assignee: email, "me", or "none"')
    .option('--label <label>', 'Set labels (repeatable, replaces all)', collect)
    .option('--project <project>', 'Project name or "none"')
    .option('--team <team>', 'Move to team (team key)')
    .option('--due-date <date>', 'Due date (ISO format) or "none"')
    .option('-i, --interactive', 'Open in editor')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output on success')
    .action(async (identifier, options) => {
      // Implementation
    });
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
```

**`src/lib/frontmatter.ts`**

```typescript
export interface ParsedInput {
  fields: Record<string, unknown>;
  description?: string;
}

export function parseFrontmatter(input: string): ParsedInput {
  // Parse YAML frontmatter and markdown body
  // Handle edge cases (no frontmatter, empty frontmatter, etc.)
}

export function renderFrontmatter(issue: Issue): string {
  // Render issue as editable frontmatter format
  // Include helpful comments
}
```

### API Functions

**Add to `src/lib/api.ts`:**

```typescript
export interface IssueUpdateInput {
  title?: string;
  description?: string;
  stateId?: string;
  priority?: number;
  assigneeId?: string | null;  // null to unassign
  labelIds?: string[];
  projectId?: string | null;   // null to remove
  teamId?: string;
  dueDate?: string | null;
  estimate?: number;
}

export async function updateIssue(
  client: LinearClient,
  issueId: string,
  input: IssueUpdateInput
): Promise<Issue> {
  // Execute mutation
}

export async function getWorkflowStates(
  client: LinearClient,
  teamId: string
): Promise<WorkflowState[]> {
  // Get available states for a team
}

export async function getLabels(
  client: LinearClient,
  teamId: string
): Promise<Label[]> {
  // Get available labels for a team
}
```

### Resolution Functions

**Add to `src/lib/resolve.ts`:**

```typescript
// Resolve state name to state ID
export async function resolveState(
  client: LinearClient,
  teamId: string,
  stateName: string
): Promise<string> {
  const states = await getWorkflowStates(client, teamId);
  const state = states.find(s =>
    s.name.toLowerCase() === stateName.toLowerCase()
  );
  if (!state) {
    const names = states.map(s => s.name).join(', ');
    throw new Error(`State '${stateName}' not found. Available: ${names}`);
  }
  return state.id;
}

// Resolve label names to label IDs
export async function resolveLabels(
  client: LinearClient,
  teamId: string,
  labelNames: string[]
): Promise<string[]> {
  const labels = await getLabels(client, teamId);
  return labelNames.map(name => {
    const label = labels.find(l =>
      l.name.toLowerCase() === name.toLowerCase()
    );
    if (!label) {
      throw new Error(`Label '${name}' not found`);
    }
    return label.id;
  });
}

// Resolve assignee to user ID
export async function resolveAssignee(
  client: LinearClient,
  assignee: string
): Promise<string | null> {
  if (assignee === 'none') return null;
  if (assignee === 'me') {
    const viewer = await getViewer(client);
    return viewer.id;
  }
  // Look up by email
  const user = await getUserByEmail(client, assignee);
  if (!user) {
    throw new Error(`User '${assignee}' not found`);
  }
  return user.id;
}
```

---

## Command Flow

### Piped Input Flow

```
1. Check authentication
2. Read stdin
3. Parse frontmatter + description
4. Fetch current issue (for team context and change diff)
5. Resolve field values to IDs:
   - state name → stateId
   - assignee → assigneeId
   - label names → labelIds (with add/remove logic)
   - project name → projectId
6. Build IssueUpdateInput
7. Execute mutation
8. Output result (show diff of changed fields)
```

### Flag Input Flow

```
1. Check authentication
2. If no flags and TTY: open interactive mode
3. If no flags and not TTY: error "No changes specified"
4. Fetch current issue
5. Resolve flag values to IDs
6. Build IssueUpdateInput from flags
7. Execute mutation
8. Output result
```

### Interactive Mode Flow

```
1. Check authentication
2. Fetch current issue (all fields)
3. Render as frontmatter with comments
4. Write to temp file
5. Open $EDITOR (fallback: vim, then nano)
6. Wait for editor to close
7. Read temp file
8. Parse frontmatter
9. Compute diff (skip unchanged fields)
10. If no changes: "No changes made"
11. Resolve and execute mutation
12. Output result
```

---

## Error Handling

| Scenario | Error Message | Exit Code |
|----------|---------------|-----------|
| Not authenticated | `Error: Not authenticated. Run 'linproj auth login' first` | 1 |
| Issue not found | `Error: Issue 'PROJ-999' not found` | 1 |
| Invalid YAML | `Error: Invalid YAML in frontmatter: <parse error>` | 1 |
| Description in frontmatter | `Error: Use the body for description, not the 'description' field` | 1 |
| Unknown field | `Error: Unknown field 'foo'. Valid fields: title, state, priority, ...` | 1 |
| State not found | `Error: State 'InvalidState' not found. Available: Todo, In Progress, Done` | 1 |
| Label not found | `Error: Label 'nonexistent' not found` | 1 |
| User not found | `Error: User 'unknown@example.com' not found` | 1 |
| No changes | `No changes to apply` | 0 |
| Empty title | `Error: Title cannot be empty` | 1 |
| API error | `Error: <Linear API error message>` | 1 |

---

## Testing

### Unit Tests

**`tests/unit/frontmatter.test.ts`**

```typescript
import { describe, test, expect } from 'bun:test';
import { parseFrontmatter, renderFrontmatter } from '../../src/lib/frontmatter';

describe('parseFrontmatter', () => {
  test('parses frontmatter with description', () => {
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

  test('parses frontmatter only', () => {
    const input = `---
title: 'New title'
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.title).toBe('New title');
    expect(result.description).toBeUndefined();
  });

  test('parses description only (no frontmatter)', () => {
    const input = 'Just a description';

    const result = parseFrontmatter(input);
    expect(result.fields).toEqual({});
    expect(result.description).toBe('Just a description');
  });

  test('handles empty frontmatter', () => {
    const input = `---
---

Description only.`;

    const result = parseFrontmatter(input);
    expect(result.fields).toEqual({});
    expect(result.description).toBe('Description only.');
  });

  test('parses labels array', () => {
    const input = `---
labels:
  - bug
  - urgent
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.labels).toEqual(['bug', 'urgent']);
  });

  test('rejects description in frontmatter', () => {
    const input = `---
title: 'New title'
description: 'Not allowed'
---`;

    expect(() => parseFrontmatter(input)).toThrow(
      "Use the body for description, not the 'description' field"
    );
  });

  test('ignores comments in frontmatter', () => {
    const input = `---
# This is a comment
title: 'New title'
# Another comment
---`;

    const result = parseFrontmatter(input);
    expect(result.fields.title).toBe('New title');
  });
});
```

### Integration Tests

**`tests/integration/issues-edit.test.ts`**

```typescript
import { describe, test, expect, afterAll } from 'bun:test';
import { setupPolly } from '../setup';

describe('issues edit', () => {
  const polly = setupPolly('issues-edit');

  afterAll(() => polly.stop());

  test('updates issue title', async () => {
    const client = new LinearClient(testAuth);
    const updated = await updateIssue(client, 'issue-uuid', {
      title: 'New title'
    });

    expect(updated.title).toBe('New title');
  });

  test('updates issue state', async () => {
    const client = new LinearClient(testAuth);
    const updated = await updateIssue(client, 'issue-uuid', {
      stateId: 'state-uuid'
    });

    expect(updated.state.name).toBe('In Progress');
  });

  test('unassigns issue', async () => {
    const client = new LinearClient(testAuth);
    const updated = await updateIssue(client, 'issue-uuid', {
      assigneeId: null
    });

    expect(updated.assignee).toBeNull();
  });

  test('updates labels', async () => {
    const client = new LinearClient(testAuth);
    const updated = await updateIssue(client, 'issue-uuid', {
      labelIds: ['label-1-uuid', 'label-2-uuid']
    });

    expect(updated.labels.nodes).toHaveLength(2);
  });
});
```

### E2E Tests

```typescript
describe('issues edit CLI', () => {
  test('edits issue via piped stdin', async () => {
    const input = `---
title: 'Updated via CLI'
---`;

    const result = await runCLI(['issues', 'edit', 'TEST-123'], { stdin: input });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Updated TEST-123');
  });

  test('edits issue via flags', async () => {
    const result = await runCLI([
      'issues', 'edit', 'TEST-123',
      '--title', 'Flag update',
      '--priority', 'high'
    ]);

    expect(result.exitCode).toBe(0);
  });

  test('outputs JSON with --json flag', async () => {
    const result = await runCLI([
      'issues', 'edit', 'TEST-123',
      '--title', 'JSON test',
      '--json'
    ]);

    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.issue.title).toBe('JSON test');
  });
});
```

---

## Implementation Order

### Step 1: Frontmatter Parser
- [ ] Create `src/lib/frontmatter.ts`
- [ ] Implement `parseFrontmatter()`
- [ ] Implement `renderFrontmatter()`
- [ ] Add unit tests

### Step 2: Resolution Functions
- [ ] Add `getWorkflowStates()` to API
- [ ] Add `getLabels()` to API
- [ ] Add `getUserByEmail()` to API
- [ ] Create `src/lib/resolve.ts`
- [ ] Add tests

### Step 3: Update Mutation
- [ ] Add `updateIssue()` to API
- [ ] Add integration tests with Polly recordings

### Step 4: Edit Command (Flags)
- [ ] Create `src/commands/issues/edit.ts`
- [ ] Implement flag-based editing
- [ ] Add `--json` and `--quiet` options
- [ ] Register command
- [ ] Add tests

### Step 5: Edit Command (Stdin)
- [ ] Add stdin reading
- [ ] Integrate frontmatter parser
- [ ] Handle description updates
- [ ] Add tests

### Step 6: Interactive Mode
- [ ] Implement temp file creation
- [ ] Implement `$EDITOR` invocation
- [ ] Implement diff detection
- [ ] Add tests

---

## Future Considerations

- **Dry run mode**: `--dry-run` to show what would change without applying
- **Batch editing**: `linproj issues edit --filter "team:ENG state:Backlog" --state "Todo"` to update multiple issues
- **Templates**: Save common edits as templates
- **Undo**: Track recent edits for quick undo (would require local state)
