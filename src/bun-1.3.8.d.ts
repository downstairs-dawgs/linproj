/**
 * Type declarations for Bun 1.3.8 APIs not yet in bun-types.
 * These can be removed once bun-types is updated.
 */

declare module "bun" {
  interface MarkdownRenderCallbacks {
    heading?: (children: string, meta: { level: number; id?: string }) => string | null;
    paragraph?: (children: string) => string | null;
    blockquote?: (children: string) => string | null;
    code?: (children: string, meta?: { language?: string }) => string | null;
    list?: (children: string, meta: { ordered: boolean; start?: number }) => string | null;
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
    link?: (children: string, meta: { href: string; title?: string }) => string | null;
    image?: (children: string, meta: { src: string; title?: string }) => string | null;
    codespan?: (children: string) => string | null;
    strikethrough?: (children: string) => string | null;
    html?: (children: string) => string | null;
    text?: (text: string) => string | null;
  }

  interface MarkdownOptions {
    tables?: boolean;
    strikethrough?: boolean;
    tasklists?: boolean;
    autolinks?: boolean | {
      url?: boolean;
      www?: boolean;
      email?: boolean;
    };
  }

  interface Markdown {
    render(input: string, callbacks?: MarkdownRenderCallbacks, options?: MarkdownOptions): string;
  }

  interface WrapAnsiOptions {
    hard?: boolean;
    wordWrap?: boolean;
    trim?: boolean;
  }

  var markdown: Markdown;
  function wrapAnsi(text: string, columns: number, options?: WrapAnsiOptions): string;
  function stringWidth(text: string): number;
}
