# Initial Implementation Plan

**Date:** 2026-01-23
**Goal:** Minimal working CLI with auth and basic issue listing

## Overview

Build `linproj` CLI that can:
1. Authenticate with Linear via API key
2. List issues assigned to the current user

Use Bun for runtime and compilation to standalone binary.

---

## Project Structure

```
linproj/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── auth/
│   │   │   ├── index.ts      # auth command group
│   │   │   ├── login.ts      # auth login
│   │   │   ├── logout.ts     # auth logout
│   │   │   └── status.ts     # auth status
│   │   └── issues/
│   │       ├── index.ts      # issues command group
│   │       └── list.ts       # issues list
│   └── lib/
│       ├── config.ts         # config file read/write
│       ├── api.ts            # Linear GraphQL client
│       └── paths.ts          # XDG config paths
├── tests/
│   ├── recordings/           # Polly.js HTTP fixtures
│   ├── integration/
│   │   ├── auth.test.ts
│   │   └── issues.test.ts
│   └── setup.ts              # Test configuration
├── package.json
├── tsconfig.json
├── .gitignore
├── docs/
│   └── design/
│       ├── authentication.md
│       └── 20260123-initial-commit.md
└── build/                    # gitignored, binary output
```

---

## Step 1: Project Setup

### Tasks
- [ ] `bun init`
- [ ] Configure `tsconfig.json` for strict TypeScript
- [ ] Add `commander` dependency
- [ ] Create `.gitignore` with `node_modules/`, `build/`
- [ ] Create basic CLI skeleton with `--help` and `--version`

### Files to Create
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `src/index.ts`

### Verification
```bash
bun run src/index.ts --help
# Expected: Usage info with available commands

bun run src/index.ts --version
# Expected: 0.1.0
```

---

## Step 2: Build System

### Tasks
- [ ] Add build script to package.json
- [ ] Test binary compilation

### package.json scripts
```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build ./src/index.ts --compile --outfile build/linproj",
    "build:release": "bun build ./src/index.ts --compile --minify --outfile build/linproj"
  }
}
```

### Verification
```bash
bun run build
./build/linproj --help
# Expected: Same output as Step 1
```

---

## Step 3: Config Management

### Tasks
- [ ] Implement `src/lib/paths.ts` - XDG config path resolution
- [ ] Implement `src/lib/config.ts` - read/write JSON config

### Config Schema (Discriminated Union)
```typescript
// Auth is a discriminated union (ADT) - each variant has exactly the fields it needs
type ApiKeyAuth = {
  type: 'api-key';
  apiKey: string;
};

type OAuthAuth = {
  type: 'oauth';
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

type Auth = ApiKeyAuth | OAuthAuth;

interface Config {
  auth?: Auth;
}
```

The `type` field is the discriminant - TypeScript will narrow the type correctly:
```typescript
if (config.auth?.type === 'api-key') {
  // TypeScript knows: config.auth.apiKey exists
}
```

### Verification
```bash
# Unit test or manual test
bun run src/lib/config.ts  # if we add a test block
```

---

## Step 4: Linear API Client

### Tasks
- [ ] Implement `src/lib/api.ts` - GraphQL fetch wrapper
- [ ] Handle auth header injection
- [ ] Basic error handling for API errors

### API Interface
```typescript
class LinearClient {
  constructor(token: string, method: 'api-key' | 'oauth');

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T>;

  // Convenience methods
  async getViewer(): Promise<User>;
  async getAssignedIssues(first?: number): Promise<Issue[]>;
}
```

### Verification
```bash
# Will be tested via auth login command
```

---

## Step 5: Auth Commands

### Tasks
- [ ] Implement `linproj auth login`
  - `--method api-key` (default for now)
  - `--method oauth` → "Not yet implemented"
  - Interactive prompt only (no `--token` flag - security risk)
  - Support stdin pipe for CI/scripts
- [ ] Implement `linproj auth status` - show current auth state
- [ ] Implement `linproj auth logout` - remove stored credentials

### Auth Login Flow (API Key)
1. Check if stdin is a TTY
   - If TTY: prompt interactively (hide input)
   - If pipe: read from stdin
2. Validate key by querying `viewer`
3. On success: save to config, print user info
4. On failure: print error, exit 1

### Verification
```bash
# Interactive login (user types/pastes key, input hidden)
./build/linproj auth login --method api-key
# Expected: Prompts for key, then "✓ Authenticated as <name> (<email>)"

# Non-interactive via stdin (for scripts)
echo "$LINEAR_API_KEY" | ./build/linproj auth login --method api-key
# Expected: ✓ Authenticated as <name> (<email>)

# Invalid key via stdin
echo "invalid" | ./build/linproj auth login --method api-key
# Expected: Error: Invalid API key (exit 1)

# Check status
./build/linproj auth status
# Expected: Logged in as <name> (<email>) via API key

# OAuth (not implemented)
./build/linproj auth login --method oauth
# Expected: Error: OAuth authentication not yet implemented

# Logout
./build/linproj auth logout
# Expected: ✓ Logged out
```

---

## Step 6: Issues List Command

### Tasks
- [ ] Implement `linproj issues list`
- [ ] Load auth from config
- [ ] Query assigned issues
- [ ] Format output as table

### GraphQL Query
```graphql
query {
  viewer {
    assignedIssues(first: 50) {
      nodes {
        identifier
        title
        state {
          name
        }
        priority
        updatedAt
      }
    }
  }
}
```

### Output Format
```
ID        STATE        PRI  TITLE
PROJ-123  In Progress  2    Fix login bug
PROJ-124  Todo         1    Add dark mode
PROJ-125  Done         3    Update docs
```

### Verification
```bash
./build/linproj issues list
# Expected: Table of assigned issues (or "No issues assigned" if empty)

# Without auth
./build/linproj auth logout
./build/linproj issues list
# Expected: Error: Not authenticated. Run `linproj auth login` first.
```

---

## Step 7: Final Polish

### Tasks
- [ ] Error messages are clear and actionable
- [ ] Exit codes are correct (0 success, 1 error)
- [ ] `--help` works on all commands
- [ ] Binary size check (should be reasonable, <50MB ideally)

### Verification
```bash
# Full flow test
echo "$LINEAR_API_KEY" | ./build/linproj auth login --method api-key
./build/linproj auth status
./build/linproj issues list
./build/linproj auth logout
./build/linproj auth status  # Should show not authenticated

# Binary size
ls -lh ./build/linproj
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `commander` | ^12.x | CLI argument parsing |

**Dev dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| `@pollyjs/core` | ^6.x | HTTP record/replay for tests |
| `@pollyjs/adapter-node-http` | ^6.x | Node HTTP adapter for Polly |
| `@pollyjs/persister-fs` | ^6.x | File system persister for recordings |

No other runtime dependencies. Using Bun's built-in `fetch` for HTTP.

---

## Testing Strategy

### Integration Tests with Polly.js

Use [Polly.js](https://github.com/Netflix/pollyjs) (Netflix) for VCR-style HTTP recording/replay.

**Directory structure:**
```
tests/
├── recordings/           # Recorded HTTP fixtures (git tracked)
│   ├── auth-login/
│   └── issues-list/
├── integration/
│   ├── auth.test.ts
│   └── issues.test.ts
└── setup.ts              # Polly configuration
```

**How it works:**
1. First run with `POLLY_MODE=record` makes real API calls, saves to `recordings/`
2. Subsequent runs replay from recordings (fast, deterministic, no network)
3. `recordIfMissing: true` auto-records new tests

**Example test:**
```typescript
import { Polly } from '@pollyjs/core';

describe('auth login', () => {
  let polly: Polly;

  beforeEach(() => {
    polly = new Polly('auth-login', {
      adapters: ['node-http'],
      persister: 'fs',
      recordIfMissing: true,
    });
  });

  afterEach(() => polly.stop());

  it('validates API key and returns user info', async () => {
    // This call is recorded/replayed
    const result = await loginWithApiKey('lin_api_xxx');
    expect(result.name).toBeDefined();
  });
});
```

**Test workspace:**
- Create a dedicated Linear workspace for testing
- Use a test API key (with minimal permissions)
- Recordings are sanitized (tokens redacted) before commit

### Running Tests

```bash
# Run tests (uses recordings)
bun test

# Re-record all fixtures
POLLY_MODE=record bun test

# Record only missing fixtures
POLLY_MODE=record_missing bun test
```

---

## Non-Goals (for this iteration)

- OAuth implementation (stubbed only)
- Issue creation/editing
- Team/project filtering
- Pagination beyond first 50 issues
- Windows support testing
- CI/CD

---

## Timeline

This is a minimal viable implementation. Each step builds on the previous and has a concrete verification test.
