# Terminal Markdown Rendering

**Date:** 2026-02-01
**Goal:** Pretty-print markdown content (issue descriptions, comments) in the terminal using Bun's built-in markdown parser

## Overview

Linear stores text content (issue descriptions, comments) as markdown. Currently, linproj displays this as raw text, which works but doesn't leverage markdown structure for better readability.

Bun v1.3.8 introduced `Bun.markdown`, a high-performance CommonMark-compliant parser written in Zig. Combined with Bun's ANSI utilities (`Bun.color()`, `Bun.wrapAnsi()`, `Bun.stringWidth()`), we can render markdown beautifully in the terminal without external dependencies.

**Design principles:**
1. **Zero dependencies**: Use only Bun built-ins
2. **Graceful degradation**: Fall back to raw text in non-TTY environments
3. **Readable over pretty**: Prioritize clarity over visual complexity
4. **Terminal-aware**: Respect terminal width, handle edge cases (no color support, narrow terminals)

---

## Bun.markdown API

### Three Rendering Functions

```typescript
// Render to HTML string
Bun.markdown.html(input: string, options?: Options): string;

// Render with custom callbacks (what we'll use)
Bun.markdown.render(input: string, callbacks?: RenderCallbacks, options?: Options): string;

// Render to React JSX (not relevant for CLI)
Bun.markdown.react(input: string, components?: ComponentOverrides, options?: ReactOptions): JSX.Element;
```

### RenderCallbacks Interface

Each callback receives the accumulated children as a string and optional metadata:

```typescript
interface RenderCallbacks {
  heading?: (children: string, meta: { level: 1-6, id?: string }) => string | null;
  paragraph?: (children: string) => string | null;
  blockquote?: (children: string) => string | null;
  code?: (children: string, meta?: { language?: string }) => string | null;
  list?: (children: string, meta: { ordered: boolean, start?: number }) => string | null;
  listItem?: (children: string, meta?: { checked?: boolean }) => string | null;
  hr?: () => string | null;
  table?: (children: string) => string | null;
  thead?: (children: string) => string | null;
  tbody?: (children: string) => string | null;
  tr?: (children: string) => string | null;
  th?: (children: string, meta?: { align?: "left" | "center" | "right" }) => string | null;
  td?: (children: string, meta?: { align?: "left" | "center" | "right" }) => string | null;
  strong?: (children: string) => string | null;
  emphasis?: (children: string) => string | null;
  link?: (children: string, meta: { href: string, title?: string }) => string | null;
  image?: (children: string, meta: { src: string, title?: string }) => string | null;
  codespan?: (children: string) => string | null;
  strikethrough?: (children: string) => string | null;
  html?: (children: string) => string | null;
  text?: (text: string) => string | null;
}
```

Returning `null` or `undefined` omits the element from output.

### Parser Options

```typescript
interface Options {
  tables?: boolean;              // GFM tables (default: true)
  strikethrough?: boolean;       // ~~text~~ (default: true)
  tasklists?: boolean;           // - [x] items (default: true)
  autolinks?: boolean | {        // Auto-link URLs (default: true)
    url?: boolean;
    www?: boolean;
    email?: boolean;
  };
  // Less common options
  wikiLinks?: boolean;           // [[page]] syntax (default: false)
  underline?: boolean;           // __underline__ (default: false)
  latexMath?: boolean;           // $math$ (default: false)
  headings?: boolean | {
    ids?: boolean;               // Generate heading IDs
    autolink?: boolean;          // Link headings to themselves
  };
}
```

---

## ANSI Utilities

Bun provides complementary utilities for terminal work:

### Bun.color()

Convert colors to ANSI escape codes:

```typescript
Bun.color("red", "ansi");           // "\x1b[38;2;255;0;0m"
Bun.color("#ff6600", "ansi");       // "\x1b[38;2;255;102;0m"
Bun.color("rgb(100, 149, 237)", "ansi");
```

### Bun.wrapAnsi()

Word-wrap text while preserving ANSI codes:

```typescript
Bun.wrapAnsi(text, columns, {
  hard: false,              // Break long words (default: false)
  wordWrap: true,           // Wrap at word boundaries (default: true)
  trim: true,               // Trim whitespace (default: true)
});
```

### Bun.stringWidth()

Calculate display width (handles emoji, wide chars, ANSI):

```typescript
Bun.stringWidth("hello");                    // 5
Bun.stringWidth("\x1b[31mhello\x1b[0m");     // 5 (ignores ANSI)
Bun.stringWidth("👋");                        // 2
```

### Bun.stripANSI()

Remove ANSI escape codes:

```typescript
Bun.stripANSI("\x1b[31mhello\x1b[0m");  // "hello"
```

---

## Implementation Design

### File Structure

```
src/lib/
├── terminal-markdown.ts    # Main renderer
└── ansi.ts                 # ANSI color constants and helpers
```

### ANSI Constants

```typescript
// src/lib/ansi.ts
export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const ITALIC = '\x1b[3m';
export const UNDERLINE = '\x1b[4m';
export const STRIKETHROUGH = '\x1b[9m';

// Colors (using standard 16 colors for compatibility)
export const RED = '\x1b[31m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const BLUE = '\x1b[34m';
export const MAGENTA = '\x1b[35m';
export const CYAN = '\x1b[36m';
export const WHITE = '\x1b[37m';
export const GRAY = '\x1b[90m';

// Check if colors are supported
export function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY ?? false;
}

// Get terminal width
export function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}
```

### Renderer Implementation

```typescript
// src/lib/terminal-markdown.ts
import * as ansi from './ansi.ts';

export interface RenderOptions {
  width?: number;           // Terminal width (default: auto-detect or 80)
  colors?: boolean;         // Use colors (default: auto-detect)
  indent?: number;          // Base indentation (default: 0)
}

export function renderMarkdown(input: string, options: RenderOptions = {}): string {
  const width = options.width ?? ansi.getTerminalWidth();
  const useColors = options.colors ?? ansi.supportsColor();
  const baseIndent = options.indent ?? 0;

  // No-op style functions when colors disabled
  const style = useColors
    ? (code: string, text: string) => `${code}${text}${ansi.RESET}`
    : (_code: string, text: string) => text;

  const callbacks: RenderCallbacks = {
    heading: (children, { level }) => {
      const prefix = '#'.repeat(level) + ' ';
      return `\n${style(ansi.BOLD, prefix + children)}\n`;
    },

    paragraph: (children) => {
      const wrapped = Bun.wrapAnsi(children, width - baseIndent);
      return wrapped + '\n';
    },

    strong: (children) => style(ansi.BOLD, children),

    emphasis: (children) => style(ansi.ITALIC, children),

    codespan: (children) => style(ansi.CYAN + ansi.DIM, `\`${children}\``),

    code: (children, meta) => {
      const lang = meta?.language;
      const header = lang ? `${style(ansi.DIM, `[${lang}]`)}\n` : '';
      const lines = children.split('\n');
      const indented = lines.map(l => `  ${style(ansi.DIM, l)}`).join('\n');
      return `\n${header}${indented}\n`;
    },

    blockquote: (children) => {
      const lines = children.trimEnd().split('\n');
      const quoted = lines.map(l => style(ansi.DIM, `│ `) + l).join('\n');
      return quoted + '\n';
    },

    link: (children, { href }) => {
      // If link text matches URL, just show the URL
      if (children === href) {
        return style(ansi.UNDERLINE + ansi.CYAN, href);
      }
      return `${style(ansi.UNDERLINE + ansi.CYAN, children)} ${style(ansi.DIM, `(${href})`)}`;
    },

    image: (_children, { src, title }) => {
      const label = title || 'image';
      return style(ansi.DIM, `[${label}: ${src}]`);
    },

    list: (children, { ordered, start }) => {
      // Children already formatted by listItem
      return children;
    },

    listItem: (children, meta) => {
      let bullet: string;
      if (meta?.checked === true) {
        bullet = style(ansi.GREEN, '✓');
      } else if (meta?.checked === false) {
        bullet = '○';
      } else {
        bullet = '•';
      }
      const content = children.trim();
      // Handle multiline list items
      const lines = content.split('\n');
      const first = `  ${bullet} ${lines[0]}`;
      const rest = lines.slice(1).map(l => `    ${l}`).join('\n');
      return first + (rest ? '\n' + rest : '') + '\n';
    },

    strikethrough: (children) => style(ansi.STRIKETHROUGH, children),

    hr: () => `\n${style(ansi.DIM, '─'.repeat(Math.min(40, width - baseIndent)))}\n`,

    // Tables - simplified approach
    table: (children) => '\n' + children,
    thead: (children) => children,
    tbody: (children) => children,
    tr: (children) => children + '\n',
    th: (children) => style(ansi.BOLD, children.padEnd(15)) + ' ',
    td: (children) => children.padEnd(15) + ' ',

    // Pass through HTML as-is (Linear sometimes includes it)
    html: (children) => style(ansi.DIM, children),
  };

  return Bun.markdown.render(input, callbacks);
}

// Convenience function for rendering with auto line wrapping
export function renderMarkdownBlock(input: string, options: RenderOptions = {}): string {
  const rendered = renderMarkdown(input, options);
  // Ensure consistent trailing newline
  return rendered.endsWith('\n') ? rendered : rendered + '\n';
}
```

---

## Integration Points

### Issue Description (src/commands/issues/get.ts)

```typescript
// Before (line 62-66):
if (issue.description) {
  console.log();
  console.log('Description:');
  console.log(issue.description);
}

// After:
import { renderMarkdownBlock } from '../../lib/terminal-markdown.ts';

if (issue.description) {
  console.log();
  console.log('Description:');
  console.log(renderMarkdownBlock(issue.description));
}
```

### Comment Bodies (src/lib/comments-display.ts)

```typescript
// Before (line 48-51):
const lines = node.body.split('\n');
for (const line of lines) {
  console.log(`${indent}${line}`);
}

// After:
import { renderMarkdown } from './terminal-markdown.ts';

const rendered = renderMarkdown(node.body, {
  indent: depth * 2,
  width: process.stdout.columns ? process.stdout.columns - (depth * 2) : 78,
});
// Split and print with base indentation
for (const line of rendered.trimEnd().split('\n')) {
  console.log(`${indent}${line}`);
}
```

---

## Visual Examples

### Before (Raw Markdown)

```
Description:
## Problem

The `fetchUsers` function throws a timeout error after 10 seconds.

### Steps to reproduce
1. Call `fetchUsers()` with a large dataset
2. Wait for the timeout

**Expected**: Results return within 30s
**Actual**: Timeout at 10s

See related issue: https://github.com/example/repo/issues/123
```

### After (Rendered)

```
Description:

## Problem

The `fetchUsers` function throws a timeout error after 10 seconds.

### Steps to reproduce

  • Call `fetchUsers()` with a large dataset
  • Wait for the timeout

Expected: Results return within 30s
Actual: Timeout at 10s

See related issue: https://github.com/example/repo/issues/123
```

(With ANSI styling: headings bold, code in cyan, links underlined)

---

## Edge Cases

### 1. Non-TTY Output

When piping to a file or another command, disable colors:

```typescript
if (!process.stdout.isTTY) {
  // Raw output, no ANSI codes
}
```

### 2. NO_COLOR Environment Variable

Respect the [NO_COLOR](https://no-color.org/) standard:

```typescript
if (process.env.NO_COLOR) {
  // Disable colors
}
```

### 3. Narrow Terminals

Handle terminals narrower than typical content:

```typescript
const minWidth = 40;
const width = Math.max(minWidth, process.stdout.columns ?? 80);
```

### 4. Invalid Markdown

Bun.markdown is lenient - invalid markdown passes through as text. No special handling needed.

### 5. Very Long Code Blocks

Code blocks should not be wrapped (preserve formatting):

```typescript
code: (children, meta) => {
  // Don't wrap - preserve original formatting
  const lines = children.split('\n');
  return lines.map(l => `  ${l}`).join('\n') + '\n';
}
```

### 6. Nested Lists

Handle indentation accumulation:

```typescript
// Track list depth in render state
// Increase indent for nested lists
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/terminal-markdown.test.ts
import { describe, test, expect } from 'bun:test';
import { renderMarkdown } from '../../src/lib/terminal-markdown.ts';

describe('renderMarkdown', () => {
  test('renders headings with bold', () => {
    const result = renderMarkdown('# Hello', { colors: true });
    expect(result).toContain('\x1b[1m');  // Bold
    expect(result).toContain('# Hello');
  });

  test('renders emphasis with italic', () => {
    const result = renderMarkdown('*italic*', { colors: true });
    expect(result).toContain('\x1b[3m');  // Italic
  });

  test('renders code spans with cyan', () => {
    const result = renderMarkdown('Use `code` here', { colors: true });
    expect(result).toContain('\x1b[36m');  // Cyan
  });

  test('renders links with underline', () => {
    const result = renderMarkdown('[text](https://example.com)', { colors: true });
    expect(result).toContain('\x1b[4m');  // Underline
    expect(result).toContain('example.com');
  });

  test('renders task lists with checkmarks', () => {
    const result = renderMarkdown('- [x] Done\n- [ ] Todo', { colors: true });
    expect(result).toContain('✓');
    expect(result).toContain('○');
  });

  test('disables colors when option is false', () => {
    const result = renderMarkdown('**bold**', { colors: false });
    expect(result).not.toContain('\x1b[');
    expect(result).toContain('bold');
  });

  test('wraps long paragraphs', () => {
    const longText = 'word '.repeat(50);
    const result = renderMarkdown(longText, { width: 40 });
    const lines = result.trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  test('preserves code block formatting', () => {
    const code = '```js\nconst x = 1;\nconst y = 2;\n```';
    const result = renderMarkdown(code);
    expect(result).toContain('const x = 1;');
    expect(result).toContain('const y = 2;');
  });
});
```

### Integration Tests

Test the full rendering pipeline in actual commands:

```typescript
// tests/e2e/terminal-markdown.test.ts
describe('terminal markdown in issue display', () => {
  test('issue description renders markdown', async () => {
    // Create issue with markdown description
    // Verify output contains styled elements
  });

  test('comments render markdown', async () => {
    // Create comment with markdown
    // Verify output is formatted
  });

  test('--json bypasses markdown rendering', async () => {
    // Verify JSON output has raw markdown
  });
});
```

---

## Bun Version Requirement

This feature requires **Bun >= 1.3.8** for `Bun.markdown`.

### Enforcing the Version

Add to `package.json`:

```json
{
  "packageManager": "bun@1.3.8",
  "scripts": {
    "preinstall": "bun scripts/check-bun-version.ts"
  }
}
```

```typescript
// scripts/check-bun-version.ts
const REQUIRED = "1.3.8";

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

if (compareVersions(Bun.version, REQUIRED) < 0) {
  console.error(`Error: Bun ${REQUIRED}+ required (you have ${Bun.version})`);
  console.error('Run: bun upgrade');
  process.exit(1);
}
```

CI already uses `oven-sh/setup-bun@v2` which reads `packageManager` from package.json automatically.

---

## Implementation Order

### Phase 1: Core Renderer
- [ ] Create `src/lib/ansi.ts` with ANSI constants and helpers
- [ ] Create `src/lib/terminal-markdown.ts` with `renderMarkdown()`
- [ ] Add unit tests for basic markdown elements
- [ ] Add unit tests for edge cases (no color, narrow width)

### Phase 2: Issue Integration
- [ ] Update `src/commands/issues/get.ts` to use renderer for descriptions
- [ ] Add E2E test for issue description rendering

### Phase 3: Comments Integration
- [ ] Update `src/lib/comments-display.ts` to use renderer
- [ ] Handle indentation for nested comments
- [ ] Add E2E test for comment rendering

### Phase 4: Version Enforcement
- [ ] Add `packageManager` field to `package.json`
- [ ] Create `scripts/check-bun-version.ts`
- [ ] Add preinstall hook
- [ ] Update README with version requirement

---

## Future Enhancements

- **Syntax highlighting**: Use `Bun.color()` for basic keyword highlighting in code blocks
- **Table rendering**: Use `Bun.inspect.table()` for better table output
- **Link detection**: Make URLs clickable in terminals that support OSC 8 hyperlinks
- **Theme support**: Light/dark mode based on terminal background
- **Custom styles**: Allow user configuration via config file

---

## References

- [Bun v1.3.8 Release Notes](https://bun.com/blog/bun-v1.3.8)
- [CommonMark Spec](https://spec.commonmark.org/)
- [GFM Spec](https://github.github.com/gfm/)
- [NO_COLOR Standard](https://no-color.org/)
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [OSC 8 Hyperlinks](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
