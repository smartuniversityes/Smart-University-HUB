"use client";

import { Fragment, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";
import { cn } from "@/lib/utils";

/**
 * Renders the assistant's Markdown as real React elements instead of raw
 * symbols. The lexer's tokens are mapped directly to elements, so raw HTML in
 * a model answer is ignored (never injected) and links are limited to safe
 * protocols.
 */
export function ChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      {renderBlocks(marked.lexer(content), "md")}
    </div>
  );
}

function safeHref(href: string | null | undefined): string {
  if (!href) return "#";
  return /^(https?:|mailto:)/i.test(href) ? href : "#";
}

function renderInline(tokens: Token[] | undefined, keyPrefix: string): ReactNode {
  if (!tokens || tokens.length === 0) return null;

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (token.type) {
      case "strong":
        return (
          <strong key={key} className="font-semibold text-foreground">
            {renderInline(token.tokens, key)}
          </strong>
        );
      case "em":
        return <em key={key}>{renderInline(token.tokens, key)}</em>;
      case "del":
        return (
          <del key={key} className="opacity-70">
            {renderInline(token.tokens, key)}
          </del>
        );
      case "codespan":
        return (
          <code
            key={key}
            className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]"
          >
            {token.text}
          </code>
        );
      case "br":
        return <br key={key} />;
      case "link":
        return (
          <a
            key={key}
            href={safeHref(token.href)}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-primary"
          >
            {renderInline(token.tokens, key) || token.text}
          </a>
        );
      case "text":
        return token.tokens ? (
          <Fragment key={key}>{renderInline(token.tokens, key)}</Fragment>
        ) : (
          <Fragment key={key}>{token.text}</Fragment>
        );
      case "escape":
        return <Fragment key={key}>{token.text}</Fragment>;
      case "html":
        // Never inject model-provided HTML.
        return null;
      default:
        return "text" in token && token.text ? (
          <Fragment key={key}>{String(token.text)}</Fragment>
        ) : null;
    }
  });
}

const HEADING_CLASSES: Record<number, string> = {
  1: "mb-2 mt-3 text-base font-semibold first:mt-0",
  2: "mb-1.5 mt-3 text-[0.95rem] font-semibold first:mt-0",
  3: "mb-1 mt-2.5 text-sm font-semibold first:mt-0",
  4: "mb-1 mt-2 text-sm font-medium first:mt-0",
  5: "mb-1 mt-2 text-sm font-medium first:mt-0",
  6: "mb-1 mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground first:mt-0",
};

function renderBlocks(tokens: Token[], keyPrefix: string): ReactNode {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (token.type) {
      case "heading": {
        const depth = Math.min(Math.max(token.depth, 1), 6);
        const Tag = `h${depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        return (
          <Tag key={key} className={HEADING_CLASSES[depth]}>
            {renderInline(token.tokens, key)}
          </Tag>
        );
      }
      case "paragraph":
        return (
          <p key={key} className="my-1.5 first:mt-0 last:mb-0">
            {renderInline(token.tokens, key)}
          </p>
        );
      case "list": {
        const list = token as Tokens.List;
        const Tag = list.ordered ? "ol" : "ul";
        return (
          <Tag
            key={key}
            className={cn(
              "my-1.5 space-y-0.5 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0",
              list.ordered ? "list-decimal" : "list-disc",
            )}
          >
            {list.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`} className="pl-0.5">
                {renderBlocks(item.tokens, `${key}-${itemIndex}`)}
              </li>
            ))}
          </Tag>
        );
      }
      case "code":
        return (
          <pre
            key={key}
            className="my-2 overflow-x-auto rounded-lg bg-background/70 p-3 text-xs"
          >
            <code>{token.text}</code>
          </pre>
        );
      case "blockquote":
        return (
          <blockquote
            key={key}
            className="my-2 border-l-2 border-border pl-3 text-muted-foreground"
          >
            {renderBlocks((token as Tokens.Blockquote).tokens, key)}
          </blockquote>
        );
      case "hr":
        return <hr key={key} className="my-3 border-border/60" />;
      case "space":
      case "html":
        return null;
      case "text":
        return (
          <Fragment key={key}>
            {token.tokens ? renderInline(token.tokens, key) : token.text}
          </Fragment>
        );
      case "table":
        return (
          <div key={key} className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {(token as Tokens.Table).header.map((cell, cellIndex) => (
                    <th
                      key={`${key}-h-${cellIndex}`}
                      className="border border-border/60 bg-muted/40 px-2 py-1 text-left font-medium"
                    >
                      {renderInline(cell.tokens, `${key}-h-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(token as Tokens.Table).rows.map((row, rowIndex) => (
                  <tr key={`${key}-r-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${key}-r-${rowIndex}-${cellIndex}`}
                        className="border border-border/60 px-2 py-1 align-top"
                      >
                        {renderInline(cell.tokens, `${key}-r-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return "text" in token && token.text ? (
          <p key={key} className="my-1.5 first:mt-0 last:mb-0">
            {String(token.text)}
          </p>
        ) : null;
    }
  });
}
