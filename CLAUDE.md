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


## Integration Test Recordings (Polly)

Integration tests replay recorded Linear API responses via [Polly.JS](https://netflix.github.io/pollyjs/)
instead of hitting the network. Recordings live in `tests/recordings/<name>_<hash>/recording.har`.

Polly matches requests by body (`matchRequestsBy.body: true` in `tests/setup.ts`), so
any change to a GraphQL query string invalidates the matching recording and the test
starts missing. Each entry's `_id` is a hash of the request, so hand-editing the
request body in a HAR does not work. Re-record instead:

```sh
LINEAR_API_KEY=<downstairs-dawgs key> POLLY_MODE=record bun test tests/integration/<file>.test.ts
```

`POLLY_MODE` defaults to `replay`. See the E2E section above for selecting the
`downstairs-dawgs` key without hardcoding a workspace UUID.

### Sanitizing recordings

This repo is public and recordings embed whole API responses, so re-recording against
a real workspace commits its project names, issue titles, and user emails.

`tests/setup.ts` strips the `authorization` header on persist, so API keys do not land
in a HAR. Nothing sanitizes response bodies. That is the part you have to get right.

- Record against `downstairs-dawgs` only, never a production workspace.
- If you record elsewhere, replace the real values in the response bodies before
  committing. Leave `_id` alone: it is derived from the request, so editing a response
  does not invalidate it.
- Check what you are about to commit:

  ```sh
  git diff --cached -- tests/recordings | grep -iE '<your-org-slug>|@<your-domain>'
  ```
