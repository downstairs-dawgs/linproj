# linproj

CLI for Linear.

## Install

```bash
curl -fsSL "https://github.com/downstairs-dawgs/linproj/releases/latest/download/linproj-$(uname -s)-$(uname -m)" -o ~/.local/bin/linproj && chmod +x ~/.local/bin/linproj
```

Or build from source:
```bash
bun install && bun run build
./build/linproj --help
```

## Usage

```bash
# Authenticate with Linear (API key)
linproj auth login

# Check auth status
linproj auth status

# List your assigned issues
linproj issues list

# Create an issue
linproj issues create --title "Fix bug" --assign-to-me

# Edit an issue (opens in editor)
linproj issues edit PROJ-123

# Edit with flags
linproj issues edit PROJ-123 --state "In Progress" --assignee me --priority high

# Logout
linproj auth logout
```

## Editing Issues

The `issues edit` command supports multiple input modes:

### Interactive Mode (default)

Opens your editor with the issue in YAML frontmatter format:

```bash
linproj issues edit PROJ-123
```

The editor shows:
```yaml
---
title: 'Current issue title'
state: 'In Progress'
priority: high
assignee: jane@example.com
labels:
  - bug
  - backend
---

Current description text here.
```

Delete fields you don't want to change. Save and close to apply.

### Flag Mode

Quick edits directly from the command line:

```bash
linproj issues edit PROJ-123 --title "New title"
linproj issues edit PROJ-123 --state "Done" --priority high
linproj issues edit PROJ-123 --assignee me          # Assign to yourself
linproj issues edit PROJ-123 --assignee none        # Unassign
linproj issues edit PROJ-123 --label bug --label urgent  # Set labels
```

### Piped Input (for scripting/AI agents)

```bash
cat <<EOF | linproj issues edit PROJ-123
---
title: 'Updated title'
state: 'In Progress'
priority: high
---

New description with **markdown** support.
EOF
```

### Output Options

```bash
linproj issues edit PROJ-123 --state "Done" --json   # JSON output
linproj issues edit PROJ-123 --state "Done" --quiet  # No output on success
```

### Recovery

If an edit fails after you've entered content, your input is saved to a recovery file:

```bash
linproj issues edit PROJ-123 --recover /tmp/linproj-recovery-PROJ-123-1706054400.md
```

## Development

```bash
bun install
bun run src/index.ts --help
```
