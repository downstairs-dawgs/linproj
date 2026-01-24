# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.1]: https://github.com/downstairs-dawgs/linproj/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/downstairs-dawgs/linproj/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/downstairs-dawgs/linproj/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/downstairs-dawgs/linproj/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/downstairs-dawgs/linproj/releases/tag/v0.1.0
