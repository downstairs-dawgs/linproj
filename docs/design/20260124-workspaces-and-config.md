# Design: Multiple Workspaces and Default Team

This document describes the implementation of workspace management and default team configuration for linproj.

## Summary

- Add workspace profiles to support multiple Linear organizations
- Add `workspace` commands (list, switch, current)
- Add `config` commands (get, set, unset) for default-team
- Migrate existing single-auth config to workspace-based config

---

## Config Structure

### Schema Versioning

The config file includes a `$schema` field for version identification:

```json
{
  "$schema": "https://linproj.dev/config/v2.json",
  "currentWorkspace": "Acme Corp",
  "workspaces": { ... }
}
```

This allows:
- Easy identification of config version when parsing
- Future tooling (IDE autocomplete, validation)
- Clear migration path for future schema changes

### Current (v1 - implicit)

No schema field. Identified by absence of `$schema` or presence of top-level `auth`:

```typescript
interface ConfigV1 {
  auth?: Auth;
}
```

### New (v2)

```typescript
const CONFIG_SCHEMA_V2 = 'https://linproj.dev/config/v2.json';

interface WorkspaceProfile {
  name: string;              // User-friendly name (defaults to org name)
  organizationId: string;    // Linear org ID
  organizationName: string;  // Linear org name (from API)
  auth: Auth;
  defaultTeam?: string;      // Team key (e.g., "ENG")
}

interface ConfigV2 {
  $schema: typeof CONFIG_SCHEMA_V2;
  currentWorkspace?: string;
  workspaces: Record<string, WorkspaceProfile>;
}
```

### Version Detection

```typescript
function getConfigVersion(config: unknown): 1 | 2 {
  if (typeof config === 'object' && config !== null) {
    if ('$schema' in config && config.$schema === CONFIG_SCHEMA_V2) {
      return 2;
    }
  }
  return 1;  // Legacy or empty config
}
```

### Migration

- **Silent migration**: On any write operation, v1 configs are migrated to v2
- `auth login` triggers migration by fetching org info and creating workspace profile
- `LINEAR_API_KEY` env var creates ephemeral `__env__` workspace (not persisted)

---

## New Commands

### `workspace list`
```
$ linproj workspace list
  Acme Corp (current) [default team: ENG]
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
Current workspace: Acme Corp
Default team: ENG
```

### `config set default-team <key>`
```
$ linproj config set default-team ENG
Default team set to: ENG
```

### `config get default-team`
```
$ linproj config get default-team
ENG
```

### `config unset default-team`
```
$ linproj config unset default-team
Default team cleared
```

---

## Modified Commands

### `auth login`
- Add `--name <name>` option to set workspace name (defaults to org name)
- Fetch organization info via new `getOrganization()` API call
- Create/update workspace profile in v2 config
- Set as current workspace

### `auth logout`
- Add `--all` flag to remove all workspaces
- Add `--workspace <name>` to remove specific workspace
- Default: removes current workspace

### `auth status`
- Show workspace name and default team
- Show migration notice for v1 configs

### `issues list` / `issues create` / `issues search` / `issues get`
- Add `--workspace <name>` flag to use a different workspace for that command
- Use `defaultTeam` from current workspace when `--team` not specified
- Print note when using default team (on create only)

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
| `src/lib/config.ts` | Add v2 types, `isV2Config()`, `getCurrentContext()` |
| `src/lib/api.ts` | Add `getOrganization()` |
| `src/commands/auth/login.ts` | Create workspace profiles, add `--name` |
| `src/commands/auth/logout.ts` | Add `--all`, `--workspace` |
| `src/commands/auth/status.ts` | Show workspace info |
| `src/commands/issues/list.ts` | Use default team |
| `src/commands/issues/create.ts` | Use default team |
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

---

## Implementation Order

1. **Foundation**: Add types and helpers to `config.ts`, add `getOrganization()` to `api.ts`
2. **Workspace commands**: Create workspace list/switch/current
3. **Auth updates**: Update login/logout/status for v2 config
4. **Config commands**: Create config get/set/unset
5. **Integration**: Wire default team into issues list/create
6. **Tests**: Unit tests for config, integration tests for commands

---

## Verification

1. `bun test` - Run test suite
2. Manual test flow:
   - `linproj auth login` - Creates workspace profile
   - `linproj workspace list` - Shows workspace
   - `linproj workspace current` - Shows current
   - `linproj config set default-team <team>` - Sets default
   - `linproj issues list` - Uses default team
   - `linproj issues create -t "Test"` - Uses default team
   - Add second workspace, test switching
