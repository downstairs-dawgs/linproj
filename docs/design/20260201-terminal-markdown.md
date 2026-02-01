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

### Bun.markdown.render()

We use `Bun.markdown.render()` with custom callbacks to transform markdown into ANSI-styled terminal output:

```typescript
Bun.markdown.render(input: string, callbacks?: RenderCallbacks, options?: Options): string;
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

## Linear's Markdown Features

Linear's editor supports standard markdown plus some extensions. Here's what we need to handle:

| Feature | Linear Syntax | Terminal Rendering |
|---------|---------------|-------------------|
| Bold | `**text**` | ANSI bold |
| Italic | `_text_` | ANSI italic |
| Strikethrough | `~text~` | ANSI strikethrough |
| Inline code | `` `code` `` | Cyan + dim |
| Headings | `#`, `##`, `###` | Bold with prefix |
| Bulleted lists | `*`, `-`, `+` | `•` bullets |
| Numbered lists | `1.` | Actual numbers |
| Checklists | `- [ ]`, `- [x]` | `○` / `✓` |
| Blockquotes | `>` | `│` prefix, dimmed |
| Code blocks | ` ``` ` | Indented, dimmed |
| Tables | `\|--` | Dynamic columns |
| Links | `[text](url)` | Underlined + OSC 8 |
| Horizontal rule | `___` | `─` line |
| @mentions | `@user` | Rendered as profile links by Linear |
| Issue refs | `ENG-123` | Auto-linked by Linear |
| Collapsible | `>>>` | Render as blockquote (can't collapse) |
| Mermaid | ` ```mermaid ` | Show as code (see Future Enhancements) |
| Embeds | YouTube/Figma links | Show as links |
| Emojis | `:emoji:` | Pass through (terminal renders natively) |

**Key insight:** Linear's API returns markdown where @mentions and issue references are already converted to markdown links. Mentions use profile URLs in the format `[Display Name](https://linear.app/{workspace}/profiles/{username})`, and issue references arrive as `[ENG-123](https://linear.app/{workspace}/issue/ENG-123/...)`. We don't need to detect these patterns ourselves.

---

## Implementation Design

### File Structure

```
src/lib/
├── terminal-markdown.ts    # Main renderer
└── ansi.ts                 # ANSI color constants and helpers
```

### ANSI Utilities Module

```typescript
// src/lib/ansi.ts

// Text styles (no Bun.color() equivalent for these)
export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const ITALIC = '\x1b[3m';
export const UNDERLINE = '\x1b[4m';
export const STRIKETHROUGH = '\x1b[9m';

// Colors using Bun.color() for consistency with Bun APIs
export const RED = Bun.color('red', 'ansi');
export const GREEN = Bun.color('green', 'ansi');
export const YELLOW = Bun.color('yellow', 'ansi');
export const BLUE = Bun.color('blue', 'ansi');
export const MAGENTA = Bun.color('magenta', 'ansi');
export const CYAN = Bun.color('cyan', 'ansi');
export const WHITE = Bun.color('white', 'ansi');
export const GRAY = Bun.color('gray', 'ansi');

// OSC 8 hyperlinks (clickable links in supported terminals)
export const linkStart = (url: string) => `\x1b]8;;${url}\x1b\\`;
export const linkEnd = '\x1b]8;;\x1b\\';

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

The main challenge is that `RenderCallbacks` is stateless—each callback is independent. To handle ordered lists and nested lists properly, we use closure variables to track state across callbacks.

```typescript
// src/lib/terminal-markdown.ts
import * as ansi from './ansi.ts';

export interface RenderOptions {
  width?: number;           // Terminal width (default: auto-detect or 80)
  colors?: boolean;         // Use colors (default: auto-detect)
  hyperlinks?: boolean;     // Use OSC 8 clickable links (default: auto-detect TTY)
}

export function renderMarkdown(input: string, options: RenderOptions = {}): string {
  const width = options.width ?? ansi.getTerminalWidth();
  const useColors = options.colors ?? ansi.supportsColor();
  const useHyperlinks = options.hyperlinks ?? (process.stdout.isTTY ?? false);

  // No-op style functions when colors disabled
  const style = useColors
    ? (code: string, text: string) => `${code}${text}${ansi.RESET}`
    : (_code: string, text: string) => text;

  // Hyperlink wrapper (OSC 8)
  const hyperlink = useHyperlinks
    ? (url: string, text: string) => `${ansi.linkStart(url)}${text}${ansi.linkEnd}`
    : (_url: string, text: string) => text;

  // ═══════════════════════════════════════════════════════════════════════════
  // State tracking for lists (closures allow state across stateless callbacks)
  // ═══════════════════════════════════════════════════════════════════════════

  let listStack: Array<{ ordered: boolean; counter: number; depth: number }> = [];

  const callbacks: RenderCallbacks = {
    heading: (children, { level }) => {
      const prefix = '#'.repeat(level) + ' ';
      return `\n${style(ansi.BOLD, prefix + children)}\n`;
    },

    paragraph: (children) => {
      const wrapped = Bun.wrapAnsi(children, width);
      return wrapped + '\n';
    },

    strong: (children) => style(ansi.BOLD, children),

    emphasis: (children) => style(ansi.ITALIC, children),

    codespan: (children) => style(ansi.CYAN + ansi.DIM, `\`${children}\``),

    code: (children, meta) => {
      const lang = meta?.language;
      // Special handling for mermaid - just show as code, can't render diagrams
      const header = lang ? `${style(ansi.DIM, `[${lang}]`)}\n` : '';
      const lines = children.split('\n');
      // Don't wrap code - preserve original formatting
      const indented = lines.map(l => `  ${style(ansi.DIM, l)}`).join('\n');
      return `\n${header}${indented}\n`;
    },

    blockquote: (children) => {
      const lines = children.trimEnd().split('\n');
      const quoted = lines.map(l => style(ansi.DIM, `│ `) + l).join('\n');
      return quoted + '\n';
    },

    link: (children, { href }) => {
      const styledText = style(ansi.UNDERLINE + ansi.CYAN, children);
      const clickable = hyperlink(href, styledText);

      // If link text matches URL, just show the URL
      if (children === href) {
        return clickable;
      }
      // Show link text, make it clickable, and show URL in parens
      return `${clickable} ${style(ansi.DIM, `(${href})`)}`;
    },

    image: (_children, { src, title }) => {
      const label = title || 'image';
      return style(ansi.DIM, `[${label}: ${src}]`);
    },

    list: (children, { ordered, start }) => {
      // Push new list context when entering a list
      listStack.push({ ordered, counter: start ?? 1, depth: listStack.length });
      const result = children;
      listStack.pop();
      return result;
    },

    listItem: (children, meta) => {
      const currentList = listStack[listStack.length - 1];
      const depth = currentList?.depth ?? 0;
      const indent = '  '.repeat(depth);

      let bullet: string;
      if (meta?.checked === true) {
        bullet = style(ansi.GREEN, '✓');
      } else if (meta?.checked === false) {
        bullet = '○';
      } else if (currentList?.ordered) {
        bullet = `${currentList.counter}.`;
        currentList.counter++;
      } else {
        bullet = '•';
      }

      const content = children.trim();
      // Handle multiline list items
      const lines = content.split('\n');
      const bulletWidth = Bun.stringWidth(bullet);
      const first = `${indent}${bullet} ${lines[0]}`;
      const rest = lines.slice(1).map(l => `${indent}${' '.repeat(bulletWidth + 1)}${l}`).join('\n');
      return first + (rest ? '\n' + rest : '') + '\n';
    },

    strikethrough: (children) => style(ansi.STRIKETHROUGH, children),

    hr: () => `\n${style(ansi.DIM, '─'.repeat(Math.min(40, width)))}\n`,

    // ═══════════════════════════════════════════════════════════════════════
    // Tables - two-pass approach for dynamic column widths
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Challenge: Callbacks receive already-rendered children, so we can't
    // measure column widths before rendering. We use a simple heuristic:
    // render cells with a separator, then post-process in the table callback.

    table: (children) => {
      // Children is pre-rendered rows with │ separators
      // Parse and re-align with proper column widths
      const rows = children.trim().split('\n').filter(r => r.length > 0);
      if (rows.length === 0) return '\n';

      // Parse cells from each row
      const parsed = rows.map(row =>
        row.split('│').map(cell => cell.trim()).filter(c => c.length > 0 || row.includes('│'))
      );

      // Calculate max width for each column (using stringWidth for ANSI safety)
      const colWidths: number[] = [];
      for (const row of parsed) {
        row.forEach((cell, i) => {
          const cellWidth = Bun.stringWidth(cell);
          colWidths[i] = Math.max(colWidths[i] ?? 0, cellWidth);
        });
      }

      // Re-render with proper padding
      const formatted = parsed.map((row, rowIdx) => {
        const cells = row.map((cell, i) => {
          const padNeeded = (colWidths[i] ?? 0) - Bun.stringWidth(cell);
          return cell + ' '.repeat(Math.max(0, padNeeded));
        });
        return cells.join('  ');  // Two spaces between columns
      });

      // Add separator after header
      if (formatted.length > 1) {
        const separator = colWidths.map(w => '─'.repeat(w)).join('──');
        formatted.splice(1, 0, style(ansi.DIM, separator));
      }

      return '\n' + formatted.join('\n') + '\n';
    },
    thead: (children) => children,
    tbody: (children) => children,
    tr: (children) => children.trim() + '\n',
    th: (children) => style(ansi.BOLD, children) + '│',
    td: (children) => children + '│',

    // Pass through HTML as-is (Linear sometimes includes it)
    html: (children) => style(ansi.DIM, children),
  };

  return Bun.markdown.render(input, callbacks);
}

// Convenience function for rendering with consistent trailing newline
export function renderMarkdownBlock(input: string, options: RenderOptions = {}): string {
  const rendered = renderMarkdown(input, options);
  return rendered.endsWith('\n') ? rendered : rendered + '\n';
}
```

### Handling Nested Lists

The `listStack` closure tracks list context:

```typescript
// When entering a list:
list: (children, { ordered, start }) => {
  listStack.push({ ordered, counter: start ?? 1, depth: listStack.length });
  const result = children;  // Process children with new context
  listStack.pop();          // Restore previous context
  return result;
}

// When rendering an item:
listItem: (children, meta) => {
  const depth = listStack[listStack.length - 1]?.depth ?? 0;
  const indent = '  '.repeat(depth);  // 2 spaces per nesting level
  // ...
}
```

This produces:

```
• First item
• Second item
  1. Nested ordered
  2. Another nested
• Back to bullets
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

// Calculate available width accounting for comment indentation
const availableWidth = (process.stdout.columns ?? 80) - (depth * 2);
const rendered = renderMarkdown(node.body, { width: availableWidth });

// Split and print with base indentation
for (const line of rendered.trimEnd().split('\n')) {
  console.log(`${indent}${line}`);
}
```

**Design rationale:** The renderer's `RenderOptions` interface does not include an `indent` parameter. Indentation is intentionally handled by the caller (comment display code) rather than the renderer, since the caller knows the nesting context. The renderer only needs to know the available width for line wrapping.

---

## Visual Examples

> **Note:** The examples below show the structural changes. ANSI styling (bold, italic,
> colors, underlines) cannot be displayed in static markdown. In practice, headings
> render bold, inline code renders cyan, links render underlined and cyan, etc.

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

## Problem                              ← bold

The `fetchUsers` function throws a      ← `fetchUsers` in cyan
timeout error after 10 seconds.

### Steps to reproduce                  ← bold

  1. Call `fetchUsers()` with a large dataset
  2. Wait for the timeout               ← numbered (not bullets)

Expected: Results return within 30s     ← "Expected" in bold
Actual: Timeout at 10s                  ← "Actual" in bold

See related issue: example/repo#123     ← underlined, cyan, clickable (OSC 8)
                   (https://github.com/example/repo/issues/123)
```

### Table Example

Input:
```markdown
| Name | Status | Priority |
|------|--------|----------|
| Auth bug | Open | High |
| UI tweak | Done | Low |
```

Output:
```
Name      Status  Priority
────────  ──────  ────────    ← dim separator
Auth bug  Open    High
UI tweak  Done    Low
```

---

## Edge Cases

### 1. Non-TTY Output

When piping to a file or another command, disable colors and hyperlinks:

```typescript
if (!process.stdout.isTTY) {
  // Raw output, no ANSI codes or OSC 8 sequences
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

Bun.markdown is lenient—invalid markdown passes through as text. No special handling needed.

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

Use closure state to track list depth (see "Handling Nested Lists" above):

```typescript
let listStack: Array<{ ordered: boolean; counter: number; depth: number }> = [];
// Push on list enter, pop on list exit
// Use depth for indentation: '  '.repeat(depth)
```

### 7. Mermaid Diagrams

Linear supports ` ```mermaid ` code blocks for diagrams. We can't render these graphically in the terminal—they display as regular code blocks with `[mermaid]` label.

### 8. Collapsible Sections

Linear's `>>>` collapsible sections can't actually collapse in a terminal. Render them as blockquotes with a visual indicator:

```typescript
// Detect >>> at start of blockquote and render with ▶ prefix
blockquote: (children) => {
  const isCollapsible = children.startsWith('>>>');
  const content = isCollapsible ? children.slice(3).trim() : children;
  const prefix = isCollapsible ? '▶ ' : '│ ';
  // ...
}
```

### 9. OSC 8 Hyperlink Support

Not all terminals support OSC 8 clickable links. Major terminals that do:
- iTerm2, Hyper, Windows Terminal, GNOME Terminal (3.26+), Konsole, WezTerm

Terminals that don't (links show as plain underlined text, still readable):
- Basic Terminal.app, older xterm, some SSH clients

The hyperlinks degrade gracefully—unsupported terminals just ignore the escape sequences.

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/terminal-markdown.test.ts
import { describe, test, expect } from 'bun:test';
import { renderMarkdown } from '../../src/lib/terminal-markdown.ts';

describe('renderMarkdown', () => {
  describe('inline formatting', () => {
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

    test('renders links with underline and OSC 8', () => {
      const result = renderMarkdown('[text](https://example.com)', { colors: true, hyperlinks: true });
      expect(result).toContain('\x1b[4m');     // Underline
      expect(result).toContain('\x1b]8;;');    // OSC 8 start
      expect(result).toContain('example.com');
    });

    test('renders strikethrough', () => {
      const result = renderMarkdown('~~deleted~~', { colors: true });
      expect(result).toContain('\x1b[9m');  // Strikethrough
    });
  });

  describe('lists', () => {
    test('renders unordered lists with bullets', () => {
      const result = renderMarkdown('- One\n- Two', { colors: false });
      expect(result).toContain('• One');
      expect(result).toContain('• Two');
    });

    test('renders ordered lists with numbers', () => {
      const result = renderMarkdown('1. First\n2. Second', { colors: false });
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
    });

    test('renders task lists with checkmarks', () => {
      const result = renderMarkdown('- [x] Done\n- [ ] Todo', { colors: true });
      expect(result).toContain('✓');
      expect(result).toContain('○');
    });

    test('handles nested lists with proper indentation', () => {
      const md = '- Parent\n  - Child\n  - Child 2\n- Parent 2';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('• Parent');
      expect(result).toContain('  • Child');  // Indented
    });

    test('handles mixed ordered/unordered nested lists', () => {
      const md = '1. First\n   - Nested bullet\n2. Second';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('1. First');
      expect(result).toContain('  • Nested bullet');
      expect(result).toContain('2. Second');
    });
  });

  describe('tables', () => {
    test('renders tables with dynamic column widths', () => {
      const md = '| Name | Value |\n|------|-------|\n| foo | 1 |\n| longer | 2 |';
      const result = renderMarkdown(md, { colors: false });
      // Columns should be aligned
      expect(result).toContain('Name');
      expect(result).toContain('Value');
      expect(result).toContain('───');  // Separator
    });

    test('renders table headers bold', () => {
      const md = '| Header |\n|--------|\n| cell |';
      const result = renderMarkdown(md, { colors: true });
      expect(result).toContain('\x1b[1m');  // Bold for header
    });
  });

  describe('options', () => {
    test('disables colors when option is false', () => {
      const result = renderMarkdown('**bold**', { colors: false });
      expect(result).not.toContain('\x1b[');
      expect(result).toContain('bold');
    });

    test('disables hyperlinks when option is false', () => {
      const result = renderMarkdown('[link](https://example.com)', { hyperlinks: false, colors: true });
      expect(result).not.toContain('\x1b]8;;');  // No OSC 8
    });

    test('wraps long paragraphs to specified width', () => {
      const longText = 'word '.repeat(50);
      const result = renderMarkdown(longText, { width: 40 });
      const lines = result.trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('code blocks', () => {
    test('preserves code block formatting', () => {
      const code = '```js\nconst x = 1;\nconst y = 2;\n```';
      const result = renderMarkdown(code);
      expect(result).toContain('const x = 1;');
      expect(result).toContain('const y = 2;');
    });

    test('shows language label for code blocks', () => {
      const code = '```typescript\nlet x = 1;\n```';
      const result = renderMarkdown(code, { colors: false });
      expect(result).toContain('[typescript]');
    });

    test('handles mermaid blocks as code', () => {
      const mermaid = '```mermaid\ngraph TD\nA --> B\n```';
      const result = renderMarkdown(mermaid, { colors: false });
      expect(result).toContain('[mermaid]');
      expect(result).toContain('graph TD');
    });
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

  test('--raw shows unrendered markdown', async () => {
    // Create issue with markdown
    // Verify --raw shows original markdown text
  });
});
```

---

## CLI Options

### `--raw` Flag

Add a `--raw` flag to bypass markdown rendering and show the original markdown text. Useful for:
- Debugging rendering issues
- Piping to other tools that expect markdown
- Users who prefer raw output

```bash
linproj issues get ENG-123 --raw        # Show raw markdown description
linproj issues comments ENG-123 --raw   # Show raw markdown comments
```

Implementation: Pass `{ colors: false, hyperlinks: false }` and skip the renderer entirely, or create a `rawMarkdown` option that returns input unchanged.

---

## Implementation Order

### Phase 1: Core Renderer
- [ ] Create `src/lib/ansi.ts` with ANSI constants and helpers
- [ ] Create `src/lib/terminal-markdown.ts` with `renderMarkdown()`
- [ ] Add unit tests for basic markdown elements
- [ ] Add unit tests for edge cases (no color, narrow width)
- [ ] Add unit tests for ordered lists, nested lists, tables

### Phase 2: Issue Integration
- [ ] Update `src/commands/issues/get.ts` to use renderer for descriptions
- [ ] Add `--raw` flag to bypass rendering
- [ ] Add E2E test for issue description rendering

### Phase 3: Comments Integration
- [ ] Update `src/lib/comments-display.ts` to use renderer
- [ ] Handle indentation for nested comments
- [ ] Add `--raw` flag to comments command
- [ ] Add E2E test for comment rendering

---

## Future Enhancements

### Mermaid Diagram Rendering

Currently, mermaid code blocks display as plain code with a `[mermaid]` label. Two packages could enable ASCII diagram rendering:

- **[beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid)**: Renders mermaid diagrams to ASCII art
- **[mermaidtui](https://github.com/tariqshams/mermaidtui)**: Terminal UI for mermaid diagrams

Initial implementation will show mermaid as code blocks, but these packages are worth exploring for a future iteration to provide actual diagram visualization in the terminal.

### Other Enhancements

- **Syntax highlighting**: Use `Bun.color()` for basic keyword highlighting in code blocks (language-aware)
- **Theme support**: Light/dark mode detection based on terminal background (`COLORFGBG` env var)
- **Custom styles**: Allow user configuration via config file (`~/.config/linproj/theme.json`)
- **Image previews**: For terminals that support inline images (iTerm2, Kitty), show image thumbnails
- **`--color=always/never/auto`**: Explicit color control flag for scripting

---

## References

- [Bun v1.3.8 Release Notes](https://bun.com/blog/bun-v1.3.8)
- [CommonMark Spec](https://spec.commonmark.org/)
- [GFM Spec](https://github.github.com/gfm/)
- [NO_COLOR Standard](https://no-color.org/)
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [OSC 8 Hyperlinks](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
