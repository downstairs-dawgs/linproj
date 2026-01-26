# Design: Multiple Workspaces and Default Team

This document describes the implementation of workspace management and default team configuration for linproj.

## Summary

- Add workspace profiles to support multiple Linear organizations
- Add `workspace` commands (list, switch, current)
- Add `config` commands (get, set, unset, migrate) for default-team
- Store workspaces in separate files for isolation
- Require explicit migration from v1 to v2 config

---

## Config Structure

### File Layout

```
~/.config/linproj/
├── config.json           # Global config (version, currentWorkspace)
└── workspaces/
    ├── 550e8400-....json # Workspace profile (filename from org ID)
    └── personal.json     # Workspace profile
```

This structure:
- Isolates workspace credentials in separate files
- Prevents accidental data leakage between workspaces in code
- Allows workspace-specific permissions if needed

### Versioning

The global config file includes a version number:

```json
{
  "version": 2,
  "currentWorkspace": "acme-corp"
}
```

The `currentWorkspace` field references a workspace file by its **filename** (without `.json`). The filename is derived from the organization's `id` from the Linear API (e.g., `550e8400-e29b-41d4-a716-446655440000`), which is guaranteed never to change. This is more reliable than `urlKey` or organization name, which could theoretically change if the organization is renamed.

### Current (v1 - implicit)

No version field. Identified by absence of `version` or presence of top-level `auth`:

```typescript
interface ConfigV1 {
  auth?: Auth;
}
```

### New (v2)

**Global config** (`~/.config/linproj/config.json`):

```typescript
interface ConfigV2 {
  version: 2;
  currentWorkspace?: string;  // References workspace file by org name
}
```

**Workspace profile** (`~/.config/linproj/workspaces/<organizationId>.json`):

```typescript
interface WorkspaceProfile {
  organizationId: string;    // Linear org ID (stable, never changes)
  organizationName: string;  // Linear org display name (for UI)
  urlKey: string;            // Linear org urlKey (for display/reference)
  auth: Auth;
  defaultTeam?: string;      // Team key (e.g., "ENG")
}
```

### Version Detection

```typescript
function getConfigVersion(config: unknown): 1 | 2 {
  if (typeof config === 'object' && config !== null) {
    if ('version' in config && config.version === 2) {
      return 2;
    }
  }
  return 1;  // Legacy or empty config
}
```

### Migration

Migration from v1 to v2 requires an explicit command:

```
$ linproj issues list
Error: Config migration required.

Your configuration uses an older format. Run:
  linproj config migrate

This will:
  - Fetch your organization info from Linear
  - Create a workspace profile for your current auth
```

The `config migrate` command:
1. Reads v1 config
2. Calls Linear API to get organization info (requires valid auth)
3. Creates workspace file in `~/.config/linproj/workspaces/<organizationId>.json`
4. Writes v2 global config with `currentWorkspace` set to the organizationId
5. Removes old `auth` from global config

### Environment Variable Override

When `LINEAR_API_KEY` is set, workspace commands will fail with an error:

```
$ linproj workspace list
Error: Workspace commands are not available when LINEAR_API_KEY is set.

To use workspaces, unset the environment variable and run:
  linproj auth login
```

This keeps the design simple - environment variable usage and workspace-based configuration are mutually exclusive. Users who want workspace features must use the config-based auth flow.

---

## New Commands

### `workspace list`
```
$ linproj workspace list
* Acme Corp [default team: ENG]
  Personal
```

### `workspace switch <name>`
```
$ linproj workspace switch Personal
Switched to workspace: Personal
```

### `workspace current`
```
$ linproj workspace current
Acme Corp
Default team: ENG
```

### `config get <key>`

Gets a config value for the current workspace. Only specific keys are supported:

```
$ linproj config get default-team
ENG
```

Supported keys:
- `default-team` - Default team key for the current workspace

### `config set <key> <value>`

Sets a config value for the current workspace:

```
$ linproj config set default-team ENG
Default team set to: ENG
```

### `config unset <key>`

Removes a config value:

```
$ linproj config unset default-team
Default team cleared
```

### `config migrate`

Migrates v1 config to v2 format:

```
$ linproj config migrate
Fetching organization info...
Created workspace: Acme Corp
Migration complete.
```

**Note on config scope**: The `config get/set/unset` commands only operate on workspace-level settings (like `default-team`). Sensitive values like auth tokens are managed through `auth login/logout` and cannot be read or modified via config commands.

**Future consideration**: A git-like layered config system (global + per-repo settings) may be added in the future. The current design doesn't preclude this - workspace profiles could later check for `.linproj/config.json` in the current directory.

---

## Modified Commands

### `auth login`
- Fetch organization info via new `getOrganization()` API call
- Create workspace file in `workspaces/` directory
- Update global config to set as current workspace
- If workspace already exists, update auth credentials

### `auth logout`
- Add `--all` flag to remove all workspaces
- Add `--workspace <name>` to remove specific workspace
- Default: removes current workspace and switches to another if available

### `auth status`
- Show workspace name and default team
- Show migration notice for v1 configs with command to run

### `issues list` / `issues create` / `issues search` / `issues get`
- Add `--workspace <name>` flag to use a different workspace for that command
- Use `defaultTeam` from current workspace when `--team` not specified
- No special output annotation needed - the team prefix in the issue ID (e.g., `ENG-123`) already indicates which team was used

---

## New API Function

```typescript
// src/lib/api.ts
export async function getOrganization(client: LinearClient): Promise<Organization> {
  const query = `query { organization { id name urlKey } }`;
  const result = await client.query<OrganizationResponse>(query);
  return result.organization;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/config.ts` | Add v2 types, workspace file I/O, `getCurrentWorkspace()` |
| `src/lib/paths.ts` | Add `WORKSPACES_DIR` constant |
| `src/lib/api.ts` | Add `getOrganization()` |
| `src/commands/auth/login.ts` | Create workspace profiles |
| `src/commands/auth/logout.ts` | Add `--all`, `--workspace` |
| `src/commands/auth/status.ts` | Show workspace info, migration notice |
| `src/commands/issues/list.ts` | Use default team |
| `src/commands/issues/create.ts` | Use default team, natural output |
| `src/index.ts` | Register workspace and config commands |

## New Files

| File | Purpose |
|------|---------|
| `src/commands/workspace/index.ts` | Workspace command group |
| `src/commands/workspace/list.ts` | List workspaces |
| `src/commands/workspace/switch.ts` | Switch workspace |
| `src/commands/workspace/current.ts` | Show current workspace |
| `src/commands/config/index.ts` | Config command group |
| `src/commands/config/get.ts` | Get config value |
| `src/commands/config/set.ts` | Set config value |
| `src/commands/config/unset.ts` | Unset config value |
| `src/commands/config/migrate.ts` | Migrate v1 to v2 config |

---

## Implementation Order

- [x] **Foundation**: Add types and helpers to `config.ts`, add `WORKSPACES_DIR` to `paths.ts`, add `getOrganization()` to `api.ts`
- [x] **Migration**: Create `config migrate` command
- [x] **Workspace commands**: Create workspace list/switch/current
- [x] **Auth updates**: Update login/logout/status for v2 config
- [x] **Config commands**: Create config get/set/unset
- [x] **Integration**: Wire default team into issues list/create
- [x] **Tests**: See Testing section below
- [ ] **Documentation**: Update README.md with new workspace and config commands

---

## Testing

### Test Harness

A `TestConfigContext` helper class exists in `tests/unit/config.test.ts` that:
- Creates a temporary directory for config files
- Sets `XDG_CONFIG_HOME` to redirect config file reads/writes to temp directory
- Provides helpers to write test configs and workspaces
- Cleans up after tests

This class can be extracted to a shared location if needed by other test files.

### Unit Tests

**`tests/unit/config.test.ts`** - COMPLETE:
- [x] `getConfigVersion()` returns 1 for empty config
- [x] `getConfigVersion()` returns 1 for v1 config with `auth`
- [x] `getConfigVersion()` returns 2 for config with `version: 2`
- [x] `readGlobalConfig()` returns empty object when file missing
- [x] `readWorkspace()` returns null when workspace file missing
- [x] `writeWorkspace()` creates workspaces directory if needed
- [x] `listWorkspaces()` returns empty array when no workspaces
- [x] `listWorkspaces()` returns all stored workspaces
- [x] `getCurrentWorkspace()` throws when v1 config
- [x] `getCurrentWorkspace()` throws when no current workspace set
- [x] `getCurrentWorkspace()` throws when workspace file missing
- [x] `setCurrentWorkspace()` updates global config
- [x] `isUsingEnvAuth()` detects LINEAR_API_KEY

**`tests/unit/migrate.test.ts`** - COMPLETE:
Tests for the `config migrate` command with mocked API:
- [x] Fails gracefully when already v2
- [x] Fails when v1 config has no auth
- [x] Migrates v1 api-key auth to workspace (mock `getOrganization()`)
- [x] Migrates v1 oauth auth to workspace
- [x] Handles API errors gracefully

**`tests/unit/auth.test.ts`** - COMPLETE:
Tests for auth commands (file operations only, no API mocking needed):
- [x] `auth logout` removes current workspace file
- [x] `auth logout --workspace` removes specific workspace
- [x] `auth logout --all` removes all workspaces
- [x] `auth status` shows workspace name
- [x] `auth status` shows migration notice for v1

### Integration Tests

**`tests/integration/config-set.test.ts`** - COMPLETE:
The `config set default-team` command validates that the team exists by calling the Linear API. This requires integration testing with API mocking:
- [x] `config set default-team ENG` validates team exists via API
- [x] `config set default-team INVALID` fails with error when team not found

Note: `config get` and `config unset` are pure file operations covered by unit tests.

**`tests/integration/issues.test.ts`** - COMPLETE:
Tests for default team integration with API mocking:
- [x] `issues list` uses default team from workspace when `--team` not specified
- [x] `issues list --team` overrides default team
- [x] `issues create` uses default team from workspace
- [x] `issues create --workspace` uses credentials from specified workspace

### E2E Tests

**CI Environment Note**: CI currently uses `LINEAR_API_KEY` for e2e tests. Since workspace commands fail when this env var is set, e2e tests for workspace-specific features will need a test harness that:
1. Unsets `LINEAR_API_KEY` for workspace tests
2. Uses `TestConfigContext` to create a temp config directory
3. Pre-populates workspace files with test credentials

**`tests/e2e/config-migration.test.ts`** - COMPLETE:
- [x] Run workspace command with v1 config → verify migration error shown
- [x] Run `config migrate` → verify workspace file created, v2 config written

**`tests/e2e/default-team.test.ts`** - COMPLETE:
- [x] Set default team via `config set` → create issue → verify issue created in default team
- [x] Create issue with `--team` flag → verify flag overrides default team

**`tests/e2e/env-var-override.test.ts`** - COMPLETE:
- [x] Run `workspace list` with `LINEAR_API_KEY` set → verify error message
- [x] Run `workspace switch` with `LINEAR_API_KEY` set → verify error message

---

## Verification

### Automated Tests

Run `bun test` to execute the full test suite.

### Manual Verification Checklist

Implementation is complete. These items can be verified manually:

1. **Migration flow**
   - [x] `linproj workspace current` with v1 config → shows migration error with command to run
   - [x] `linproj config migrate` → creates workspace, shows success message

2. **Workspace commands**
   - [x] `linproj workspace list` → shows workspace with current marked
   - [x] `linproj workspace current` → shows current workspace name and default team
   - [x] `linproj workspace switch <name>` → switches workspace

3. **Config commands**
   - [x] `linproj config get default-team` → returns value (or empty if not set)
   - [x] `linproj config set default-team <team>` → sets default team
   - [x] `linproj config unset default-team` → clears default team

4. **Default team integration**
   - [x] `linproj issues list` → uses default team when set
   - [x] `linproj issues create -t "Test"` → creates in default team

5. **Multi-workspace isolation**
   - [x] Add second workspace via `auth login`
   - [x] `workspace switch` between workspaces
   - [x] Verify each workspace has its own credentials and settings

6. **Environment variable behavior**
   - [x] `linproj workspace list` with `LINEAR_API_KEY` set → shows error
