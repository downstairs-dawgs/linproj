# Design: `linproj skill` Command

Output or install the linproj Agent Skills spec (agentskills.io) SKILL.md.

## Usage

```bash
# Print SKILL.md to stdout (default)
linproj skill

# Install for Claude Code (global)
linproj skill --mode claude

# Install for Claude Code (project)
linproj skill --mode claude-project

# Install to custom directory
linproj skill --outdir ~/my/skills

# Force create parent directories
linproj skill --mode claude --force
```

## Options

| Flag | Description |
|------|-------------|
| `-m, --mode <mode>` | Installation mode (mutually exclusive with `-o`) |
| `-o, --outdir <path>` | Custom output directory (mutually exclusive with `-m`) |
| `-f, --force` | Create parent directories if they don't exist |

## Installation Modes

| Mode | Path | Description |
|------|------|-------------|
| `claude` | `~/.claude/skills/linear/SKILL.md` | Claude Code (global) |
| `claude-global` | `~/.claude/skills/linear/SKILL.md` | Claude Code (global, explicit) |
| `claude-project` | `.claude/skills/linear/SKILL.md` | Claude Code (project) |
| `codex` | `~/.codex/skills/linear/SKILL.md` | OpenAI Codex (global) |
| `codex-global` | `~/.codex/skills/linear/SKILL.md` | OpenAI Codex (global, explicit) |
| `codex-project` | `.codex/skills/linear/SKILL.md` | OpenAI Codex (project) |
| `universal` | `~/.agent/skills/linear/SKILL.md` | Universal (Cursor, Windsurf, Aider) |
| `universal-global` | `~/.agent/skills/linear/SKILL.md` | Universal (global, explicit) |
| `universal-project` | `.agent/skills/linear/SKILL.md` | Universal (project) |
| `github` | `.github/skills/linear/SKILL.md` | VS Code Copilot |

## Behavior

1. **No flags**: Print SKILL.md content to stdout
2. **With `--mode`**: Install to predefined path for that mode
3. **With `--outdir`**: Install to `<outdir>/SKILL.md`
4. **Directory doesn't exist**: Error unless `--force` is provided

## Implementation

### File Structure

```
src/commands/skill/
├── index.ts       # Command definition and handler
└── SKILL.md       # Actual skill file (imported as text)
```

### Bun Text Import

Bun supports importing files as strings using the `with { type: "text" }` attribute. This means we can keep SKILL.md as an actual markdown file and import it directly:

```typescript
import SKILL_MD from "./SKILL.md" with { type: "text" };
```

When bundled, Bun inlines the file contents as a string constant. This approach:
- Keeps SKILL.md as a real markdown file (syntax highlighting, linting)
- No need to escape template literals or maintain a `.ts` wrapper
- File contents are embedded at build time

See: [Bun File Types - Text Loader](https://bun.com/docs/runtime/file-types)

### `src/commands/skill/SKILL.md`

The actual skill content as a markdown file:

```markdown
---
name: linear
description: >-
  Manage Linear issues using linproj CLI.
  Use when discussing task tracking, creating issues, updating issue status,
  or when user mentions Linear, issues, or tickets.
argument-hint: "[action] [issue-id]"
allowed-tools: Bash(linproj:*)
---

# Linear Issue Management

Use `linproj` CLI to manage Linear issues.

## Common Workflows
...
```
```

### `src/commands/skill/index.ts`

```typescript
import { Command, Option } from 'commander';
import SKILL_MD from './SKILL.md' with { type: 'text' };
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const MODE_PATHS: Record<string, string> = {
  'claude': '~/.claude/skills/linear/SKILL.md',
  'claude-global': '~/.claude/skills/linear/SKILL.md',
  'claude-project': '.claude/skills/linear/SKILL.md',
  'codex': '~/.codex/skills/linear/SKILL.md',
  'codex-global': '~/.codex/skills/linear/SKILL.md',
  'codex-project': '.codex/skills/linear/SKILL.md',
  'universal': '~/.agent/skills/linear/SKILL.md',
  'universal-global': '~/.agent/skills/linear/SKILL.md',
  'universal-project': '.agent/skills/linear/SKILL.md',
  'github': '.github/skills/linear/SKILL.md',
};

function expandPath(path: string): string {
  return path.startsWith('~') ? path.replace('~', homedir()) : path;
}

export function createSkillCommand(): Command {
  const skill = new Command('skill')
    .description('Output or install Agent Skills spec (agentskills.io) SKILL.md');

  const modeOption = new Option('-m, --mode <mode>', 'Installation mode')
    .choices(Object.keys(MODE_PATHS));

  skill
    .addOption(modeOption)
    .option('-o, --outdir <path>', 'Output directory for SKILL.md')
    .option('-f, --force', 'Create parent directories if needed')
    .action(async (options) => {
      // Mutually exclusive check
      if (options.mode && options.outdir) {
        console.error('Cannot use --mode and --outdir together');
        process.exit(1);
      }

      // Determine output path
      let outputPath: string;
      if (options.outdir) {
        outputPath = expandPath(join(options.outdir, 'SKILL.md'));
      } else if (options.mode) {
        outputPath = expandPath(MODE_PATHS[options.mode]);
      } else {
        // Default: print to stdout
        console.log(SKILL_MD);
        return;
      }

      // Check/create parent directory
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        if (!options.force) {
          console.error(`Directory does not exist: ${dir}`);
          console.error('Use --force to create it');
          process.exit(1);
        }
        await mkdir(dir, { recursive: true });
      }

      // Write file
      await writeFile(outputPath, SKILL_MD);
      console.log(`Installed skill to: ${outputPath}`);
    });

  return skill;
}
```

### `src/index.ts`

Add the new command:

```typescript
import { createSkillCommand } from './commands/skill/index.ts';

// ... existing commands ...
program.addCommand(createSkillCommand());
```

## Testing

```bash
# Test stdout output
bun run src/index.ts skill

# Test mode installation
bun run src/index.ts skill --mode claude --force

# Test custom output
bun run src/index.ts skill --outdir /tmp/test-skill --force

# Test error cases
bun run src/index.ts skill --mode claude  # should error if dir doesn't exist
bun run src/index.ts skill --mode invalid  # should error
bun run src/index.ts skill --mode claude --outdir /tmp  # should error (mutual exclusion)
```
