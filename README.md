# linproj

CLI for Linear.

## Install

```bash
curl -fsSL "https://github.com/downstairs-dawgs/linproj/releases/latest/download/linproj-$(uname -s)-$(uname -m)" -o ~/.local/bin/linproj && chmod +x ~/.local/bin/linproj
```

Or build from source: `bun install && bun run build`

## Quick Start

```bash
linproj auth login                              # Authenticate with API key
linproj config set default-team ENG             # Set default team (optional)
linproj issues list                             # List issues
linproj issues create --title "Bug" -a          # Create issue, assign to me
linproj issues start ENG-123                    # Start working on issue
linproj issues done ENG-123                     # Mark issue done
```

## Features

**Multi-workspace support** - Manage multiple Linear organizations, switch between them seamlessly
**Default team** - Set per-workspace default team to skip `-t` flags
**Quick actions** - `issues start` and `issues done` for fast state changes
**Flexible editing** - Interactive editor, CLI flags, or piped YAML input
**Scriptable** - `--json`, `--quiet`, `--field` options for automation
**Environment auth** - Set `LINEAR_API_KEY` to bypass workspace config
**AI agent support** - Install skills for Claude Code, Codex, and other AI tools

## Commands

### Authentication

```bash
linproj auth login                              # Authenticate (interactive)
echo "lin_api_xxx" | linproj auth login         # Authenticate (piped)
linproj auth status                             # Show current user/workspace
linproj auth logout                             # Logout current workspace
linproj auth logout --all                       # Logout all workspaces
linproj auth logout -w "Acme Corp"              # Logout specific workspace
```

### Issues

```bash
# List and search
linproj issues list                             # List issues (uses default team)
linproj issues list -t ENG                      # List issues for team
linproj issues list -a me                       # My assigned issues
linproj issues list -a none                     # Unassigned issues
linproj issues list --state-type started        # In-progress issues
linproj issues list -s "In Review"              # By state name
linproj issues list -l bug -l urgent            # By labels
linproj issues list --priority high             # By priority
linproj issues list --json                      # JSON output
linproj issues search "login bug" -t ENG        # Full-text search

# Get single issue
linproj issues get ENG-123                      # Show issue details
linproj issues get ENG-123 --json               # JSON output
linproj issues get ENG-123 --field url          # Single field (for scripting)

# Create
linproj issues create -t ENG --title "Bug"      # Create issue
linproj issues create --title "Bug" -a          # Create and assign to me
linproj issues create -p 1                      # With priority (1=urgent)

# Quick state changes
linproj issues start ENG-123                    # Move to "started" state
linproj issues done ENG-123                     # Move to "completed" state

# Edit with flags
linproj issues edit ENG-123 --state "In Review"
linproj issues edit ENG-123 --assignee me
linproj issues edit ENG-123 --assignee none
linproj issues edit ENG-123 --priority urgent
linproj issues edit ENG-123 --label bug --label backend
linproj issues edit ENG-123 --team PLATFORM     # Move to different team

# Edit interactively (opens $EDITOR)
linproj issues edit ENG-123

# Edit via stdin (for scripting/AI agents)
# Description supports full markdown
cat <<EOF | linproj issues edit ENG-123
---
title: 'Updated title'
state: 'In Progress'
priority: high
---
Description supports **markdown** formatting.
EOF
```

### Workspaces

```bash
linproj workspace list                          # List all workspaces (* = current)
linproj workspace current                       # Show current workspace
linproj workspace switch "Acme Corp"            # Switch workspace
```

### Configuration

```bash
linproj config get default-team                 # Get default team
linproj config set default-team ENG             # Set default team
linproj config set default-team ""              # Clear default team
```

### AI Agent Integration

```bash
linproj skill                                   # Print SKILL.md to stdout
linproj skill --mode claude                     # Install to ~/.claude/skills/linear/
linproj skill --mode claude-project --force     # Install to .claude/skills/linear/
```

Installs an [Agent Skills](https://agentskills.io) spec for Claude Code, Codex, and other AI tools. Modes: `claude`, `codex`, `universal`, `github`.

## Filtering Reference

| Option | Description | Values |
|--------|-------------|--------|
| `-t, --team` | Team key | `ENG`, `PLATFORM`, etc. |
| `-s, --state` | State name | `"In Progress"`, `"Done"`, etc. |
| `--state-type` | State type | `backlog`, `unstarted`, `started`, `completed`, `canceled` |
| `-a, --assignee` | Assignee | `me`, `none`, or email |
| `-l, --label` | Label (repeatable) | Label names |
| `-p, --project` | Project name | Project names |
| `--priority` | Priority | `urgent`/`1`, `high`/`2`, `medium`/`3`, `low`/`4`, `none`/`0` |

## Development

```bash
bun install
bun run src/index.ts --help
```
