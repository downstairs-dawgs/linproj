// Terminal markdown renderer using Bun.markdown
// Renders markdown to ANSI-styled terminal output

// ANSI escape codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const UNDERLINE = '\x1b[4m';
const STRIKETHROUGH = '\x1b[9m';

// OSC 8 hyperlinks (clickable in supported terminals)
const linkStart = (url: string) => `\x1b]8;;${url}\x1b\\`;
const linkEnd = '\x1b]8;;\x1b\\';

// Placeholder for list item bullets - replaced by list callback with actual bullet
const ITEM_PLACEHOLDER = '\x00ITEM\x00';

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY ?? false;
}

function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}

export interface RenderOptions {
  width?: number;
  colors?: boolean;
  hyperlinks?: boolean;
}

export function renderMarkdown(
  input: string,
  options: RenderOptions = {}
): string {
  if (!input) return '';

  const width = options.width ?? getTerminalWidth();
  const useColors = options.colors ?? supportsColor();
  const useHyperlinks = options.hyperlinks ?? (process.stdout.isTTY ?? false);

  // Style helper - applies ANSI code if colors enabled
  const style = useColors
    ? (code: string, text: string) => `${code}${text}${RESET}`
    : (_code: string, text: string) => text;

  // Hyperlink wrapper (OSC 8)
  const hyperlink = useHyperlinks
    ? (url: string, text: string) => `${linkStart(url)}${text}${linkEnd}`
    : (_url: string, text: string) => text;

  // Get cyan color code
  const cyan = Bun.color('cyan', 'ansi') ?? '';
  const green = Bun.color('green', 'ansi') ?? '';

  const result = Bun.markdown.render(input, {
    heading: (children, { level }) => {
      const prefix = '#'.repeat(level) + ' ';
      return `\n${style(BOLD, prefix + children)}\n`;
    },

    paragraph: (children) => {
      const wrapped = Bun.wrapAnsi(children, width);
      return wrapped + '\n\n';
    },

    strong: (children) => style(BOLD, children),

    emphasis: (children) => style(ITALIC, children),

    codespan: (children) => style(cyan + DIM, `\`${children}\``),

    code: (children, meta) => {
      const lang = meta?.language;
      const header = lang ? `${style(DIM, `[${lang}]`)}\n` : '';
      // Filter out empty trailing line from split, then indent each line
      const lines = children.split('\n').filter((l, i, arr) =>
        i < arr.length - 1 || l.length > 0
      );
      const indented = lines.map((l) => `  ${style(DIM, l)}`).join('\n');
      return `${header}${indented}\n`;
    },

    blockquote: (children) => {
      const lines = children.trimEnd().split('\n');
      const quoted = lines.map((l) => style(DIM, '│ ') + l).join('\n');
      return quoted + '\n';
    },

    link: (children, { href }) => {
      const styledText = style(UNDERLINE + cyan, children);
      const clickable = hyperlink(href, styledText);

      // Check if link text is redundant with the URL
      const normalizeUrl = (url: string) =>
        url
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '');

      if (children === href || normalizeUrl(children) === normalizeUrl(href)) {
        return clickable;
      }
      return `${clickable} ${style(DIM, `(${href})`)}`;
    },

    image: (_children, { src, title }) => {
      const label = title || 'image';
      return style(DIM, `[${label}: ${src}]`);
    },

    list: (children, { ordered, start }) => {
      // Replace placeholders with appropriate bullets
      let counter = start ?? 1;
      const lines = children.split('\n');
      const processed = lines
        .map((line) => {
          if (line.includes(ITEM_PLACEHOLDER)) {
            const bullet = ordered ? `${counter++}.` : '•';
            return line.replace(ITEM_PLACEHOLDER, bullet);
          }
          return line;
        })
        .join('\n');

      return '\n' + processed.trimEnd() + '\n';
    },

    listItem: (children, meta) => {
      // Handle task list items with explicit bullets
      if (meta?.checked === true) {
        const bullet = style(green, '✓');
        return formatListItem(bullet, children);
      } else if (meta?.checked === false) {
        return formatListItem('○', children);
      }

      // Use placeholder for regular items - replaced by list callback
      return formatListItem(ITEM_PLACEHOLDER, children);
    },

    strikethrough: (children) => style(STRIKETHROUGH, children),

    hr: () => `\n${style(DIM, '─'.repeat(Math.min(40, width)))}\n`,

    // Tables - render with dynamic column widths
    table: (children) => {
      const rows = children
        .trim()
        .split('\n')
        .filter((r) => r.length > 0);
      if (rows.length === 0) return '\n';

      // Parse cells from each row (cells separated by │)
      const parsed = rows.map((row) =>
        row
          .split('│')
          .map((cell) => cell.trim())
          .filter((c) => c.length > 0 || row.includes('│'))
      );

      // Calculate max width for each column
      const colWidths: number[] = [];
      for (const row of parsed) {
        row.forEach((cell, i) => {
          const cellWidth = Bun.stringWidth(cell);
          colWidths[i] = Math.max(colWidths[i] ?? 0, cellWidth);
        });
      }

      // Re-render with proper padding
      const formatted = parsed.map((row) => {
        const cells = row.map((cell, i) => {
          const padNeeded = (colWidths[i] ?? 0) - Bun.stringWidth(cell);
          return cell + ' '.repeat(Math.max(0, padNeeded));
        });
        return cells.join('  ');
      });

      // Add separator after header
      if (formatted.length > 1) {
        const separator = colWidths.map((w) => '─'.repeat(w)).join('──');
        formatted.splice(1, 0, style(DIM, separator));
      }

      return '\n' + formatted.join('\n') + '\n';
    },

    thead: (children) => children,
    tbody: (children) => children,
    tr: (children) => children.trim() + '\n',
    th: (children) => style(BOLD, children) + '│',
    td: (children) => children + '│',

    // Pass through HTML as-is (Linear sometimes includes it)
    html: (children) => style(DIM, children),
  });

  // Clean up excessive newlines, preserve leading indentation
  return result.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd() + '\n';
}

// Format a list item with proper handling of nested content
function formatListItem(bullet: string, children: string): string {
  const trimmed = children.trimEnd();
  const newlineIdx = trimmed.indexOf('\n');

  if (newlineIdx === -1) {
    // Simple item, no nested content
    return `${bullet} ${trimmed}\n`;
  }

  // Has nested content - text before newline, nested list after
  const textPart = trimmed.slice(0, newlineIdx);
  const nestedPart = trimmed.slice(newlineIdx + 1);

  // Indent nested content
  const indented = nestedPart
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');

  return `${bullet} ${textPart}\n${indented}\n`;
}
