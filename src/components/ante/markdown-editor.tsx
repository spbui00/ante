import * as React from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

import { RichText } from "@/components/ante/rich-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
 * Small markdown editor for long clinical free text: write/preview tabs plus
 * a minimal formatting toolbar. Rendering reuses <RichText /> so the preview
 * matches how the text appears everywhere else in the app.
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

  return (
    <Tabs defaultValue="write" className={cn("w-full", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="h-8">
          <TabsTrigger value="write" className="text-xs">
            Write
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            Preview
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-1">
          <ToolbarButton label="Bold" onClick={() => wrap("**")} disabled={disabled}>
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => wrap("*")} disabled={disabled}>
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            onClick={() => prefixLines(() => "- ")}
            disabled={disabled}
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            onClick={() => prefixLines((i) => `${i + 1}. `)}
            disabled={disabled}
          >
            <ListOrdered className="size-3.5" />
          </ToolbarButton>
        </div>
      </div>

      <TabsContent value="write" className="mt-2">
        <Textarea
          id={id}
          ref={ref}
          rows={rows}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="font-normal"
        />
      </TabsContent>
      <TabsContent value="preview" className="mt-2">
        <div className="min-h-[6rem] rounded-md border border-input bg-background p-3">
          {value.trim() ? (
            <RichText text={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
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
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
