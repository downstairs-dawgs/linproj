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
LINEAR_API_KEY=$(cat ~/.config/linproj/workspaces/c650d32a-125e-4cb7-83b4-b57cc2d457f2.json | jq -r '.auth.apiKey') bun test tests/e2e
```

The UUID `c650d32a-125e-4cb7-83b4-b57cc2d457f2` is the Linear workspace ID for `downstairs-dawgs`. This ensures tests run against the correct workspace.

