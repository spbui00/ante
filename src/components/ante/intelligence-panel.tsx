import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichText } from "@/components/ante/rich-text";
import { AnalyticsCardView, type AnalyticsCardData } from "@/components/ante/analytics-card";
import { AnalystChatDrawer } from "@/components/ante/analyst-chat-drawer";
import {
  analyzeSurveillance,
  deleteAnalyticsCard,
  listAnalyticsCards,
  saveAnalyticsCard,
} from "@/lib/analytics.functions";

const WINDOWS = [
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 12 months" },
];

const WIDE_KINDS = new Set(["line", "area", "bar", "table"]);
const isWide = (kind: string) => WIDE_KINDS.has(kind);

export function IntelligencePanel() {
  const qc = useQueryClient();
  const [days, setDays] = useState(60);
  const [chatOpen, setChatOpen] = useState(false);
  const [generated, setGenerated] = useState<AnalyticsCardData[]>([]);
  const [narrative, setNarrative] = useState("");
  const [contextId, setContextId] = useState<string | null>(null);

  const pinned = useQuery({
    queryKey: ["analytics-cards"],
    queryFn: () => listAnalyticsCards(),
    staleTime: 60_000,
  });

  const analyse = useMutation({
    mutationFn: (instruction?: string) =>
      analyzeSurveillance({ data: { days, ...(instruction ? { instruction } : {}) } }),
    onSuccess: (res) => {
      setGenerated(res.cards as AnalyticsCardData[]);
      setNarrative(res.narrative ?? "");
      setContextId(res.contextId ?? null);
    },
  });

  const pin = useMutation({
    mutationFn: (card: AnalyticsCardData) =>
      saveAnalyticsCard({
        data: {
          title: card.title,
          subtitle: card.subtitle ?? null,
          kind: card.kind as never,
          sql: card.sql ?? null,
          config: card.config ?? {},
          windowDays: days,
        },
      }),
    onSuccess: (_res, card) => {
      setGenerated((cards) => cards.filter((c) => c.id !== card.id));
      qc.invalidateQueries({ queryKey: ["analytics-cards"] });
    },
  });

  const unpin = useMutation({
    mutationFn: (card: AnalyticsCardData) => deleteAnalyticsCard({ data: { id: card.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics-cards"] }),
  });

  const pinnedCards = (pinned.data ?? []) as AnalyticsCardData[];

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Population intelligence</h2>
          <p className="text-xs text-muted-foreground">
            An epidemiologist agent queries the whole de-identified encounter log and builds this
            dashboard itself. Pin any card to keep it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => analyse.mutate(undefined)} disabled={analyse.isPending}>
            {analyse.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {analyse.isPending ? "Analysing…" : "Analyze"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setChatOpen(true)}>
            <Brain className="size-4" />
            Ask the epidemiologist
          </Button>
        </div>
      </div>

      {pinnedCards.length ? (
        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pinned cards
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {pinnedCards.map((c) => (
              <div key={c.id} className={isWide(c.kind) ? "md:col-span-2" : undefined}>
                <AnalyticsCardView card={{ ...c, pinned: true }} onPin={() => unpin.mutate(c)} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {analyse.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Querying the surveillance log and reasoning about the signal — this takes a moment.
          </CardContent>
        </Card>
      ) : null}

      {analyse.isError ? (
        <Card className="border-destructive/50">
          <CardContent className="py-6 text-sm text-muted-foreground">
            The analysis could not be completed: {(analyse.error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {narrative ? (
        <Card>
          <CardContent className="py-5 text-sm">
            <RichText text={narrative} />
          </CardContent>
        </Card>
      ) : null}

      {generated.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {generated.map((c) => (
            <div key={c.id} className={isWide(c.kind) ? "md:col-span-2" : undefined}>
              <AnalyticsCardView
                card={c}
                onPin={(card) => pin.mutate(card)}
                onRemove={(card) => setGenerated((cards) => cards.filter((x) => x.id !== card.id))}
              />
            </div>
          ))}
        </div>
      ) : null}

      {!analyse.isPending && !generated.length && !pinnedCards.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No analysis yet. Press <span className="font-medium text-foreground">Analyze</span> to let
            the epidemiologist agent examine the last {days} days.
          </CardContent>
        </Card>
      ) : null}

      <AnalystChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        days={days}
        contextId={contextId}
        onResult={(res) => {
          setContextId(res.contextId ?? null);
          if (res.narrative) setNarrative(res.narrative);
          if (res.cards.length) setGenerated(res.cards);
        }}
      />
    </div>
  );
}
