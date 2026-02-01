# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-02-01

### Added

#### Comment Support

Full support for Linear comment threads:

- `issues comments <identifier>` - List all comments on an issue with threaded display
- `issues comments add <identifier> [body]` - Add a new comment (supports stdin for multiline)
- `issues comments add --reply-to <id>` - Reply to an existing comment
- `issues comments add --reply-to last` - Quick reply to the most recent comment
- `issues comment edit <id> [body]` - Edit an existing comment
- `issues comment delete <id>` - Delete a comment
- `issues comment resolve <id>` - Resolve a comment thread
- `issues comment unresolve <id>` - Reopen a resolved thread

All commands support `--json` and `--quiet` flags for scripting.

#### Terminal Markdown Rendering

Issue descriptions and comments now render with rich terminal formatting:

- **Headings** - Bold with `#` prefix preserved
- **Emphasis** - Bold, italic, and ~~strikethrough~~
- **Code** - Inline \`code\` and fenced code blocks with language labels
- **Lists** - Bullets (•), numbered lists, and task lists (✓/○)
- **Links** - Clickable hyperlinks in supported terminals (OSC 8)
- **Blockquotes** - Indented with cyan accent bar
- **Tables** - Aligned columns with header separators

Use `--raw` flag to see original markdown without rendering.

#### Comment Display

Comments display with a visual tree structure:

```
◆ Alice Chen
│ 2 hours ago
│ This is the comment body with **markdown** rendering.
│
├─◇ Bob Smith
│   1 hour ago
│   This is a reply.
│
└─◇ Carol Dev
    30 min ago
    Another reply.
```

Resolved threads collapse to a compact preview:

```
✓ Dave Ops · 3 hours ago + 2 replies
  "First 45 characters of the comment..."
```

### Changed

- `issues get` now renders description markdown by default
- `issues comments` now renders comment bodies with markdown by default
- Requires Bun 1.3.8+ (for `Bun.markdown` API)

## [0.5.0] - 2026-01-28

### Added

- `projects list` command to view projects
- `projects update` command to post project status updates
- Skill examples for project status update workflow

## [0.3.1] - 2025-01-24

### Changed

- Reduced release binary sizes with minify and UPX compression
- Added experimental UPX-compressed macOS binary (`linproj-Darwin-arm64-upx`) for debugging

## [0.3.0] - 2025-01-24

### Added

- `issues edit` command with CLI flags (`--title`, `--state`, `--priority`, `--assignee`, `--label`, `--project`, `--team`, `--due-date`, `--estimate`)
- Interactive editor mode (`issues edit PROJ-123 -i`) with YAML frontmatter
- Team move support with label validation
- Recovery mode for failed edits (`--recover`)
- `--json` and `--quiet` output options on edit command

## [0.2.0] - 2025-01-23

### Added

- `issues get <identifier>` command to retrieve a single issue
- `issues search <query>` command for full-text search
- Filters on `issues list`: `--team`, `--state`, `--state-type`, `--assignee`, `--project`, `--label`, `--priority`
- `--json` output on list, get, and search commands
- `--field` option on `issues get` to extract single fields

### Changed

- `issues list` no longer defaults to "assigned to me" - use `--assignee me` for previous behavior

## [0.1.1] - 2025-01-22

### Changed

- Binary names now use uname-compatible format for simpler installation

### Added

- Installation instructions in README

## [0.1.0] - 2025-01-22

### Added

- Initial release
- `auth login`, `auth logout`, `auth status` commands
- `issues list` command (assigned to current user)
- `issues create` command with team selection, priority, and assignment
- API key authentication

[0.6.0]: https://github.com/downstairs-dawgs/linproj/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/downstairs-dawgs/linproj/compare/v0.4.0...v0.5.0
[0.3.1]: https://github.com/downstairs-dawgs/linproj/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/downstairs-dawgs/linproj/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/downstairs-dawgs/linproj/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/downstairs-dawgs/linproj/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/downstairs-dawgs/linproj/releases/tag/v0.1.0
