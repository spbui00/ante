import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCortiDictation } from "@/lib/use-corti-dictation";

import { CodeChip, UrgencyBadge } from "@/components/ante/badges";
import { Waveform } from "@/components/ante/waveform";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPreIntakeVisit } from "@/lib/intake.functions";

type IntakeResult = {
  source?: string;
  summary: string;
  symptoms: string[];
  facts?: { group: string; text: string }[];
  followUpQuestions?: string[];
  symptomCodes: { code: string; label: string }[];
  urgencyLevel: string;
  recommendation: string;
  warning?: string;
};

export function VoiceIntakeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const savePreIntake = useServerFn(createPreIntakeVisit);

  const dictation = useCortiDictation({
    language: "en",
    onFinal: (text) => setTranscript((prev) => `${prev} ${text}`.trim()),
    onError: (message) => toast.error(message),
  });

  const recording = dictation.status === "listening";
  const connecting = dictation.status === "connecting";

  async function submit() {
    if (!transcript.trim()) {
      toast.error("Add a short description first");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          language: "en",
          answers: Object.entries(answers)
            .filter(([, v]) => v.trim())
            .map(([question, answer]) => ({ question, answer })),
        }),
      });
      if (!res.ok) throw new Error("Intake failed");
      const data = (await res.json()) as IntakeResult;
      setResult(data);
      if (data.warning) toast.warning("Corti unavailable — showing a basic summary");
    } catch {
      toast.error("Could not process intake");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendToClinic() {
    if (!result) return;
    setSaving(true);
    try {
      await savePreIntake({
        data: {
          transcript,
          symptoms: result.symptoms.join(", ") || result.summary,
          symptomIcdCodes: result.symptomCodes.map((c) => c.code),
          urgencyLevel: (result.urgencyLevel as "LOW" | "MEDIUM" | "HIGH_RED_FLAG") ?? "LOW",
          recommendation: result.recommendation,
          travelHistory: [],
        },
      });
      toast.success("Pre-intake sent — your clinician will see it at check-in");
      onOpenChange(false);
      setResult(null);
      setTranscript("");
      setAnswers({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save pre-intake");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="mx-auto flex w-full max-w-md flex-col overflow-y-auto px-4 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-2xl">Tell us what's wrong</DrawerTitle>
            <DrawerDescription>
              Speak naturally. Ante turns it into a structured summary for your clinician.
            </DrawerDescription>
          </DrawerHeader>

          {/* Voice stage */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-secondary to-card p-5">
            <div
              className={`pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent blur-3xl transition-opacity duration-700 ${
                recording ? "opacity-70" : "opacity-25"
              }`}
            />

            <Waveform
              analyser={dictation.analyser}
              active={recording}
              className="relative h-24 w-full text-primary"
            />

            <div className="relative mt-4 flex flex-col items-center">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  void dictation.start();
                }}
                onPointerUp={() => dictation.stop()}
                onPointerCancel={() => dictation.stop()}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Hold to talk"
                className={`relative grid size-20 touch-none select-none place-items-center rounded-full text-primary-foreground shadow-lg transition-all duration-300 active:scale-95 ${
                  recording
                    ? "bg-destructive shadow-destructive/30 scale-105"
                    : "bg-primary shadow-primary/25 hover:scale-105"
                }`}
              >
                {recording ? (
                  <span className="ante-pulse-ring absolute inset-0 rounded-full bg-destructive" />
                ) : null}
                {connecting ? (
                  <Loader2 className="size-7 animate-spin" />
                ) : (
                  <Mic className="size-8" />
                )}
              </button>
              <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground">
                {connecting
                  ? "Connecting…"
                  : recording
                    ? "Listening… release to stop"
                    : "Hold the mic to talk"}
              </p>
            </div>
          </div>

          <div className="relative mt-4">
            <Textarea
              rows={4}
              placeholder="e.g. Dry cough for four days, fever last night, chest feels tight."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            {dictation.interim ? (
              <p className="mt-1 px-1 text-sm italic text-muted-foreground">
                {dictation.interim}
              </p>
            ) : null}
          </div>

          <Button className="mt-3" onClick={submit} disabled={submitting || recording}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Analyse symptoms
          </Button>

          {result ? (
            <div className="mt-4 rounded-2xl border border-border bg-secondary p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-foreground">Pre-intake summary</span>
                <UrgencyBadge level={result.urgencyLevel} />
              </div>
              <p className="text-muted-foreground">{result.summary}</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {result.symptomCodes.map((c) => (
                  <CodeChip key={c.code} code={c.code} system="ICD-10" />
                ))}
              </div>

              {result.followUpQuestions?.length ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    A few more questions
                  </p>
                  {result.followUpQuestions.map((q) => (
                    <div key={q} className="space-y-1">
                      <p className="text-foreground">{q}</p>
                      <Input
                        value={answers[q] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                        placeholder="Your answer"
                      />
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={submit} disabled={submitting}>
                    Update summary
                  </Button>
                </div>
              ) : null}

              <p className="mt-3 text-muted-foreground">{result.recommendation}</p>

              <Button className="mt-3 w-full" onClick={sendToClinic} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send to clinic
              </Button>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
