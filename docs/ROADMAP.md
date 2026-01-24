# linproj Roadmap

A prioritized list of features for the linproj CLI.

## Current Status

**Implemented:**
- Authentication via API key
- `auth login`, `auth logout`, `auth status`
- `issues list` with filters (team, state, assignee, project, labels, priority)
- `issues create` (with team selection, priority, assignment)
- `issues get PROJ-123` - View single issue details
- `issues search "query"` - Search issues by text
- `issues edit` with CLI flags and interactive editor mode
- `--json` output on `issues list`, `issues get`, `issues edit`

---

## Planned

### Output Formatting (v0.4)

Better support for scripting and integration.

- [x] `--json` flag on issue commands
- [x] `--field <name>` to extract single field (on `issues get`)
- [x] `--quiet` flag (on `issues edit`)
- [ ] `--format csv` for spreadsheet export

### Default Team (v0.4)

Reduce friction for users who primarily work in one team.

- [ ] `linproj config set default-team ENG`
- [ ] `linproj config get default-team`
- [ ] `linproj config unset default-team`
- [ ] Use default team in `issues create` and `issues list` when not specified

---

## Future

### OAuth Authentication

Browser-based OAuth 2.0 + PKCE flow for users who can't create personal API keys.

See: [docs/design/authentication.md](design/authentication.md)

- [ ] Register OAuth application with Linear
- [ ] Implement PKCE flow with localhost callback
- [ ] Token refresh handling
- [ ] Make OAuth the default auth method

### Multiple Workspaces

Support users who belong to multiple Linear workspaces.

- [ ] `linproj workspace list` - Show available workspaces
- [ ] `linproj workspace switch <name>` - Set active workspace
- [ ] `linproj workspace current` - Show active workspace
- [ ] Store workspace preference in config
- [ ] `--workspace` flag to override for single command

### Comments

View and add comments on issues.

- [ ] `linproj issues comments PROJ-123` - List comments
- [ ] `linproj issues comment PROJ-123 "message"` - Add comment
- [ ] `linproj issues comment PROJ-123 --edit <id>` - Edit comment

### Projects and Cycles

Manage Linear projects and cycles.

- [ ] `linproj projects list`
- [ ] `linproj projects get <name>`
- [ ] `linproj cycles list`
- [ ] `linproj cycles current`

### Claude Code Skill

Integration with Claude Code for AI-assisted issue management.

- [ ] Skill outputs issue data to stdout in parseable format
- [ ] Create issues from natural language
- [ ] Summarize issues for context
- [ ] Suggest related issues

---

## Non-Goals

These are explicitly out of scope:

- **Full Linear feature parity** - This is a CLI for common workflows, not a complete replacement for the web UI
- **Webhook/automation server** - This is a user-facing CLI, not a service
- **Custom fields management** - Too workspace-specific; use web UI
- **Admin operations** - Team management, user invites, etc. belong in web UI

---

## Contributing

Feature requests and pull requests welcome. For major changes, please open an issue first to discuss the approach.
