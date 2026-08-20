import * as React from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

import { RichText } from "@/components/ante/rich-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MarkdownEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Inline markdown editor: renders formatted text at rest and switches to a
 * plain textarea (with a light formatting toolbar) while focused.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
  disabled,
  className,
}: MarkdownEditorProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = React.useState(false);

  const wrap = (token: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next = `${value.slice(0, start)}${token}${selected}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length + selected.length);
    });
  };

  const prefixLines = (make: (index: number) => string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
    const block = value.slice(lineStart, lineEnd) || "";
    const updated = block
      .split("\n")
      .map((line, i) => (line.trim() ? `${make(i)}${line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")}` : line))
      .join("\n");
    onChange(`${value.slice(0, lineStart)}${updated}${value.slice(lineEnd)}`);
    requestAnimationFrame(() => el.focus());
  };

  if (disabled || !editing) {
    return (
      <div
        id={id}
        role={disabled ? undefined : "button"}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (disabled) return;
          setEditing(true);
          requestAnimationFrame(() => ref.current?.focus());
        }}
        onFocus={() => {
          if (!disabled) setEditing(true);
        }}
        className={cn(
          "min-h-[calc(var(--rows)*1.5rem)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          !disabled && "cursor-text hover:border-ring/50",
          className,
        )}
        style={{ ["--rows" as string]: rows }}
      >
        {value.trim() ? (
          <RichText text={value} />
        ) : (
          <span className="text-muted-foreground">{placeholder ?? "Nothing yet."}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <div className="flex items-center gap-1" onMouseDown={(e) => e.preventDefault()}>
        <ToolbarButton label="Bold" onClick={() => wrap("**")}>
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => wrap("*")}>
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => prefixLines(() => "- ")}>
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}>
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
      </div>
      <Textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        autoFocus
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange(e.target.value)}
        className="font-normal"
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
