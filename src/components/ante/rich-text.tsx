import * as React from "react";

import { cn } from "@/lib/utils";

type Token = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

/**
 * Very small inline markdown tokenizer: **bold**, __bold__, *italic*, _italic_, `code`.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input))) {
    if (match.index > last) tokens.push({ text: input.slice(last, match.index) });
    if (match[2] !== undefined) tokens.push({ text: match[2], bold: true });
    else if (match[4] !== undefined) tokens.push({ text: match[4], italic: true });
    else if (match[5] !== undefined) tokens.push({ text: match[5], code: true });
    last = match.index + match[0].length;
  }
  if (last < input.length) tokens.push({ text: input.slice(last) });
  return tokens;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((token, i) => {
        if (token.code) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              {token.text}
            </code>
          );
        }
        if (token.bold) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {token.text}
            </strong>
          );
        }
        if (token.italic) {
          return (
            <em key={i} className="italic">
              {token.text}
            </em>
          );
        }
        return <React.Fragment key={i}>{token.text}</React.Fragment>;
      })}
    </>
  );
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ol" | "ul"; items: { text: string; indented: boolean }[] };

function parseBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const indented = /^\s{2,}/.test(rawLine);
    const ordered = line.trim().match(/^(\d+)[.)]\s+(.*)$/);
    const bulleted = line.trim().match(/^[-*•]\s+(.*)$/);

    if (ordered || bulleted) {
      const kind = ordered ? "ol" : "ul";
      const text = ordered ? ordered[2] : bulleted![1];
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === kind) prev.items.push({ text, indented });
      else blocks.push({ kind, items: [{ text, indented }] });
      continue;
    }

    const prev = blocks[blocks.length - 1];
    if (prev && prev.kind === "p") prev.lines.push(line.trim());
    else blocks.push({ kind: "p", lines: [line.trim()] });
  }

  return blocks;
}

/**
 * Renders markdown-ish clinical text (bold/italic/code plus simple lists).
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed text-foreground", className)}>
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  <Inline text={line} />
                </React.Fragment>
              ))}
            </p>
          );
        }

        const ListTag = block.kind === "ol" ? "ol" : "ul";
        return (
          <ListTag
            key={i}
            className={cn(
              "space-y-1 pl-5",
              block.kind === "ol" ? "list-decimal" : "list-disc",
            )}
          >
            {block.items.map((item, j) => (
              <li key={j} className={cn("pl-1", item.indented && "ml-4 list-[circle]")}>
                <Inline text={item.text} />
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

/** Single-paragraph inline-only variant, safe for clamped previews. */
export function RichTextInline({ text, className }: { text: string; className?: string }) {
  const plain = React.useMemo(
    () => text.replace(/\r\n/g, "\n").replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "").replace(/\n+/g, " "),
    [text],
  );
  return (
    <p className={className}>
      <Inline text={plain} />
    </p>
  );
}
