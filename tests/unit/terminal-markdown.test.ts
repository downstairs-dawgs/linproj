import { describe, it, expect } from 'bun:test';
import { renderMarkdown } from '../../src/lib/terminal-markdown.ts';

describe('renderMarkdown', () => {
  describe('inline formatting', () => {
    it('renders headings with bold', () => {
      const result = renderMarkdown('# Hello', { colors: true });
      expect(result).toContain('\x1b[1m'); // Bold
      expect(result).toContain('# Hello');
    });

    it('renders h2 and h3 headings', () => {
      const result = renderMarkdown('## Level 2\n\n### Level 3', {
        colors: false,
      });
      expect(result).toContain('## Level 2');
      expect(result).toContain('### Level 3');
    });

    it('renders strong text with bold', () => {
      const result = renderMarkdown('**bold text**', { colors: true });
      expect(result).toContain('\x1b[1m'); // Bold
      expect(result).toContain('bold text');
    });

    it('renders emphasis with italic', () => {
      const result = renderMarkdown('*italic*', { colors: true });
      expect(result).toContain('\x1b[3m'); // Italic
    });

    it('renders code spans with backticks preserved', () => {
      const result = renderMarkdown('Use `code` here', { colors: false });
      expect(result).toContain('`code`');
    });

    it('renders code spans with styling when colors enabled', () => {
      const result = renderMarkdown('Use `code` here', { colors: true });
      expect(result).toContain('\x1b[2m'); // Dim
      expect(result).toContain('`code`');
    });

    it('renders strikethrough', () => {
      const result = renderMarkdown('~~deleted~~', { colors: true });
      expect(result).toContain('\x1b[9m'); // Strikethrough
    });
  });

  describe('links', () => {
    it('renders links with underline when colors enabled', () => {
      const result = renderMarkdown('[text](https://example.com)', {
        colors: true,
        hyperlinks: false,
      });
      expect(result).toContain('\x1b[4m'); // Underline
      expect(result).toContain('text');
      expect(result).toContain('(https://example.com)');
    });

    it('renders links with OSC 8 when hyperlinks enabled', () => {
      const result = renderMarkdown('[text](https://example.com)', {
        colors: true,
        hyperlinks: true,
      });
      expect(result).toContain('\x1b]8;;'); // OSC 8 start
      expect(result).toContain('example.com');
    });

    it('omits redundant URL when link text matches href', () => {
      const result = renderMarkdown(
        '[https://example.com](https://example.com)',
        { colors: false }
      );
      expect(result).toContain('https://example.com');
      // Should NOT have duplicate URL in parens
      expect(result).not.toContain('(https://example.com)');
    });

    it('omits redundant URL when link text is href without protocol', () => {
      const result = renderMarkdown('[example.com](https://example.com)', {
        colors: false,
      });
      expect(result).toContain('example.com');
      expect(result).not.toContain('(https://example.com)');
    });

    it('omits redundant URL when link text has www prefix', () => {
      const result = renderMarkdown('[www.example.com](https://example.com)', {
        colors: false,
      });
      expect(result).toContain('www.example.com');
      expect(result).not.toContain('(https://example.com)');
    });

    it('shows URL in parens when link text differs from href', () => {
      const result = renderMarkdown('[click here](https://example.com)', {
        colors: false,
      });
      expect(result).toContain('click here');
      expect(result).toContain('(https://example.com)');
    });
  });

  describe('images', () => {
    it('renders images as bracketed text', () => {
      const result = renderMarkdown('![alt text](https://example.com/img.png)', {
        colors: false,
      });
      expect(result).toContain('[image: https://example.com/img.png]');
    });

    it('uses title if provided', () => {
      const result = renderMarkdown(
        '![alt](https://example.com/img.png "My Image")',
        { colors: false }
      );
      expect(result).toContain('[My Image: https://example.com/img.png]');
    });
  });

  describe('lists', () => {
    it('renders unordered lists with bullets', () => {
      const result = renderMarkdown('- One\n- Two', { colors: false });
      expect(result).toContain('• One');
      expect(result).toContain('• Two');
    });

    it('renders ordered lists with numbers', () => {
      const result = renderMarkdown('1. First\n2. Second', { colors: false });
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
    });

    it('renders ordered lists starting from custom number', () => {
      const result = renderMarkdown('5. Fifth\n6. Sixth', { colors: false });
      expect(result).toContain('5. Fifth');
      expect(result).toContain('6. Sixth');
    });

    it('renders task lists with checkmarks', () => {
      const result = renderMarkdown('- [x] Done\n- [ ] Todo', { colors: true });
      expect(result).toContain('✓');
      expect(result).toContain('○');
    });

    it('handles nested unordered lists with proper indentation', () => {
      const md = '- Parent\n  - Child\n  - Child 2\n- Parent 2';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('• Parent');
      expect(result).toContain('  • Child');
      expect(result).toContain('  • Child 2');
      expect(result).toContain('• Parent 2');
    });

    it('handles nested ordered lists', () => {
      const md = '1. First\n   1. Nested 1\n   2. Nested 2\n2. Second';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('1. First');
      expect(result).toContain('  1. Nested 1');
      expect(result).toContain('  2. Nested 2');
      expect(result).toContain('2. Second');
    });

    it('handles mixed ordered/unordered nested lists', () => {
      const md = '1. First\n   - Nested bullet\n2. Second';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('1. First');
      expect(result).toContain('  • Nested bullet');
      expect(result).toContain('2. Second');
    });
  });

  describe('code blocks', () => {
    it('preserves code block formatting', () => {
      const code = '```\nconst x = 1;\nconst y = 2;\n```';
      const result = renderMarkdown(code, { colors: false });
      expect(result).toContain('const x = 1;');
      expect(result).toContain('const y = 2;');
    });

    it('shows language label for code blocks', () => {
      const code = '```typescript\nlet x = 1;\n```';
      const result = renderMarkdown(code, { colors: false });
      expect(result).toContain('[typescript]');
    });

    it('handles mermaid blocks as code', () => {
      const mermaid = '```mermaid\ngraph TD\nA --> B\n```';
      const result = renderMarkdown(mermaid, { colors: false });
      expect(result).toContain('[mermaid]');
      expect(result).toContain('graph TD');
    });

    it('indents code block content', () => {
      const code = '```\nline 1\nline 2\n```';
      const result = renderMarkdown(code, { colors: false });
      // Code should be indented with 2 spaces
      expect(result).toContain('  line 1');
      expect(result).toContain('  line 2');
    });
  });

  describe('blockquotes', () => {
    it('renders blockquotes with vertical bar prefix', () => {
      const result = renderMarkdown('> This is a quote', { colors: false });
      expect(result).toContain('▌ This is a quote');
    });

    it('handles multiline blockquotes', () => {
      const result = renderMarkdown('> Line 1\n> Line 2', { colors: false });
      expect(result).toContain('▌ Line 1');
      expect(result).toContain('▌ Line 2');
    });
  });

  describe('horizontal rules', () => {
    it('renders horizontal rules', () => {
      const result = renderMarkdown('---', { colors: false });
      expect(result).toContain('─');
    });
  });

  describe('tables', () => {
    it('renders tables with aligned columns', () => {
      const md =
        '| Name | Value |\n|------|-------|\n| foo | 1 |\n| longer | 2 |';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('Name');
      expect(result).toContain('Value');
      expect(result).toContain('foo');
      expect(result).toContain('longer');
    });

    it('renders separator between header and body', () => {
      const md = '| Header |\n|--------|\n| cell |';
      const result = renderMarkdown(md, { colors: false });
      expect(result).toContain('───');
    });

    it('renders table headers bold when colors enabled', () => {
      const md = '| Header |\n|--------|\n| cell |';
      const result = renderMarkdown(md, { colors: true });
      expect(result).toContain('\x1b[1m'); // Bold
    });
  });

  describe('options', () => {
    it('disables all colors when option is false', () => {
      const result = renderMarkdown('**bold** *italic* ~~strike~~', {
        colors: false,
      });
      expect(result).not.toContain('\x1b[');
      expect(result).toContain('bold');
      expect(result).toContain('italic');
    });

    it('disables hyperlinks when option is false', () => {
      const result = renderMarkdown('[link](https://example.com)', {
        hyperlinks: false,
        colors: true,
      });
      expect(result).not.toContain('\x1b]8;;'); // No OSC 8
    });

    it('wraps long paragraphs to specified width', () => {
      const longText = 'word '.repeat(50);
      const result = renderMarkdown(longText, { width: 40, colors: false });
      const lines = result.trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('respects custom width for horizontal rules', () => {
      const result = renderMarkdown('---', { width: 20, colors: false });
      const hrLine = result.trim();
      // HR should be at most 40 chars (capped) or width
      expect(hrLine.length).toBeLessThanOrEqual(40);
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(renderMarkdown('')).toBe('');
    });

    it('returns empty string for null-ish input', () => {
      expect(renderMarkdown(null as unknown as string)).toBe('');
      expect(renderMarkdown(undefined as unknown as string)).toBe('');
    });

    it('handles plain text without markdown', () => {
      const result = renderMarkdown('Just plain text', { colors: false });
      expect(result).toContain('Just plain text');
    });

    it('cleans up excessive newlines', () => {
      const result = renderMarkdown('Para 1\n\n\n\n\nPara 2', { colors: false });
      // Should not have more than 2 consecutive newlines
      expect(result).not.toContain('\n\n\n');
    });
  });
});
