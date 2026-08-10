---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.js, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- `Bun.$` instead of execa for shell commands
- `bun:sqlite` for SQLite if needed

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## E2E Testing

E2E tests run against the real Linear API using the `downstairs-dawgs` workspace. To run e2e tests:

```sh
LINEAR_API_KEY=$(jq -r 'select(.urlKey == "downstairs-dawgs") | .auth.apiKey' ~/.config/linproj/workspaces/*.json)
if [ -z "$LINEAR_API_KEY" ]; then
  echo "downstairs-dawgs workspace not configured; run: linproj auth login"
else
  bun test tests/e2e
fi
```

The workspace is selected by its `urlKey`, not by config filename. Each workspace
is stored as `~/.config/linproj/workspaces/<organizationId>.json`, and that UUID
differs per machine and changes whenever the workspace is re-authenticated, so
hardcoding it goes stale and fails as a silent 401.

Do not fall back to picking whichever workspace file happens to be first. The e2e
suite creates issues, transitions them, and posts project updates, so pointing it
at a real workspace writes test data into it. If the selector comes back empty,
the fix is to authenticate against `downstairs-dawgs`, not to substitute another
workspace.

