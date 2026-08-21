import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Brain, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/ante/rich-text";
import { askOutbreakAnalyst } from "@/lib/outbreak.functions";

type Turn = { role: "user" | "agent"; text: string };

const SUGGESTIONS = [
  "Is this an outbreak? Give me your assessment.",
  "Where are the clusters and how fast are they growing?",
  "Draft a situation report for the regional health board.",
  "What capacity should we prepare for over the next two weeks?",
];

export function OutbreakAnalystDrawer({
  open,
  onOpenChange,
  days,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  days: number;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const contextId = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const ask = useMutation({
    mutationFn: (text: string) =>
      askOutbreakAnalyst({ data: { text, contextId: contextId.current, days } }),
    onSuccess: (res) => {
      contextId.current = res.contextId;
      setTurns((t) => [...t, { role: "agent", text: res.reply }]);
    },
    onError: (err: Error) =>
      setTurns((t) => [...t, { role: "agent", text: `Could not reach the analyst: ${err.message}` }]),
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, ask.isPending]);

  function send(text: string) {
    const value = text.trim();
    if (!value || ask.isPending) return;
    setTurns((t) => [...t, { role: "user", text: value }]);
    setInput("");
    ask.mutate(value);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[92vh] flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Brain className="size-5" />
              Ask the epidemiologist
            </DrawerTitle>
            <DrawerDescription>
              Grounded in the current de-identified surveillance signal for the selected window.
            </DrawerDescription>
          </DrawerHeader>

          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {turns.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Start with</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            {turns.map((t, i) => (
              <div
                key={i}
                className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    t.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  }`}
                >
                  {t.role === "agent" ? <RichText text={t.text} /> : t.text}
                </div>
              </div>
            ))}

            {ask.isPending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  Reading the signal…
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                rows={2}
                placeholder="Ask about growth, clusters, severity or next steps…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button onClick={() => send(input)} disabled={ask.isPending || !input.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
