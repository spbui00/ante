import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mic, Sparkles, Square, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";

import { Waveform } from "@/components/ante/waveform";
import { useCortiStream, type StreamFact } from "@/lib/use-corti-stream";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ante/markdown-editor";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  draftConsultation,
  extractConsultationFacts,
  saveVisitTranscript,
  signOffConsultation,
} from "@/lib/consultation.functions";


type Fact = { group: string; text: string };
type Segment = { id: string; speakerId: number; text: string; start?: number };
type Diagnosis = { description: string; code: string | null; status: "ACTIVE" | "RESOLVED" | "SUSPECTED" };
type Prescription = { drugName: string; atcCode: string | null; dosage: string | null; frequency: string | null };
type Observation = { testName: string; loincCode: string | null; value: number | null; unit: string | null; status?: "ORDERED" | "PENDING" | "RESULTED" | "CANCELLED" };

type Draft = {
  conclusion: string;
  recommendation: string;
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  observations: Observation[];
  urgencyLevel: string;
  disposition: string;
};

/** Backup extraction cadence used when the live FactsR stream stays quiet. */
const FACT_FALLBACK_MS = 25000;

/**
 * Corti returns an arbitrary integer per detected speaker (-1 when diarization
 * is off). Number speakers by the order they first appear and leave role
 * attribution (doctor / patient / nurse) to the post-processing agent.
 */
function speakerLabel(speakerId: number, order: number[]) {
  if (speakerId < 0) return "Speaker";
  const index = order.indexOf(speakerId);
  return `Speaker ${(index < 0 ? speakerId : index) + 1}`;
}


export function ConsultationRecorder({
  visitId,
  patientName,
  open,
  onOpenChange,
  onSigned,
}: {
  visitId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSigned: () => void;
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [phase, setPhase] = useState<"record" | "drafting" | "review" | "saving">("record");
  const [draft, setDraft] = useState<Draft | null>(null);
  const liveFacts = useRef(false);
  const lastFactLength = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const extract = useServerFn(extractConsultationFacts);
  const makeDraft = useServerFn(draftConsultation);
  const signOff = useServerFn(signOffConsultation);

  const handleFacts = useCallback((incoming: StreamFact[]) => {
    liveFacts.current = true;
    setFacts((prev) => {
      const seen = new Set(prev.map((f) => f.text.toLowerCase()));
      const added = incoming
        .filter((f) => !seen.has(f.text.toLowerCase()))
        .map((f) => ({ group: f.group, text: f.text }));
      return added.length ? [...prev, ...added] : prev;
    });
  }, []);

  const handleSegment = useCallback((segment: Segment) => {
    // Diarized segments finalize per speaker, so keep the list ordered by the
    // moment the speech started rather than by arrival.
    setSegments((prev) => {
      const next = [...prev, segment];
      return next.every((s) => typeof s.start === "number")
        ? next.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
        : next;
    });
  }, []);

  const stream = useCortiStream({
    language: "en",
    visitId,
    onSegment: handleSegment,
    onFacts: handleFacts,
    onError: (message) => toast.error(message),
  });

  const speakerOrder = useMemo(() => {
    const seen: number[] = [];
    for (const s of segments) if (s.speakerId >= 0 && !seen.includes(s.speakerId)) seen.push(s.speakerId);
    return seen;
  }, [segments]);

  const transcript = segments
    .map((s) => `${speakerLabel(s.speakerId, speakerOrder)}: ${s.text}`)
    .join("\n");
  const recording = stream.status === "listening" || stream.status === "connecting";

  // Reset when the drawer is reopened for a new consultation.
  useEffect(() => {
    if (open) return;
    setSegments([]);
    setFacts([]);
    setDraft(null);
    setPhase("record");
    liveFacts.current = false;
    lastFactLength.current = 0;
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [segments]);

  const runExtraction = useCallback(
    async (text: string) => {
      if (text.length < 40) {
        toast.error("Not enough conversation captured yet");
        return;
      }
      setExtracting(true);
      try {
        const res = await extract({ data: { transcript: text } });
        lastFactLength.current = text.length;
        handleFacts(res.facts.map((f) => ({ group: f.group, text: f.text })));
      } catch {
        toast.error("Could not extract clinical facts");
      } finally {
        setExtracting(false);
      }
    },
    [extract, handleFacts],
  );

  // Safety net: if the live FactsR stream has produced nothing, extract from
  // the transcript we already have so the doctor still sees facts.
  useEffect(() => {
    if (!open || phase !== "record") return;
    const timer = setInterval(() => {
      if (liveFacts.current) return;
      const text = transcript.trim();
      if (text.length < 80 || text.length - lastFactLength.current < 120) return;
      lastFactLength.current = text.length;
      void extract({ data: { transcript: text } })
        .then((res) => handleFacts(res.facts.map((f) => ({ group: f.group, text: f.text }))))
        .catch(() => undefined);
    }, FACT_FALLBACK_MS);
    return () => clearInterval(timer);
  }, [open, phase, transcript, extract, handleFacts]);

  async function finishRecording() {
    if (recording) stream.stop();
    const text = transcript.trim();
    if (text.length < 20) {
      toast.error("Not enough conversation captured yet");
      return;
    }
    setPhase("drafting");
    try {
      const result = (await makeDraft({ data: { transcript: text, facts } })) as Draft;
      setDraft(result);
      setPhase("review");
    } catch {
      toast.error("Could not draft the consultation note");
      setPhase("record");
    }
  }

  async function confirmAndSign() {
    if (!draft) return;
    setPhase("saving");
    try {
      await signOff({
        data: {
          visitId,
          transcript: transcript.trim(),
          conclusion: draft.conclusion,
          recommendation: draft.recommendation,
          urgencyLevel: draft.urgencyLevel as "LOW" | "MEDIUM" | "HIGH_RED_FLAG",
          disposition: draft.disposition as "HOME_CARE" | "PRESCRIPTION" | "ER_REFERRAL",
          diagnoses: draft.diagnoses,
          prescriptions: draft.prescriptions,
          observations: draft.observations,
        },
      });
      toast.success("Consultation signed and saved");
      onOpenChange(false);
      onSigned();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the consultation");
      setPhase("review");
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => (phase === "saving" ? null : onOpenChange(next))}>
      <DrawerContent>
        <div className="mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Stethoscope className="size-4" />
              {phase === "review" || phase === "saving" ? "Final review" : "Ambient consultation"}
            </DrawerTitle>
            <DrawerDescription>
              {phase === "review" || phase === "saving"
                ? "Check the AI draft before signing — edit the text and remove anything that is wrong."
                : `Live diarized transcription and clinical facts for ${patientName}.`}
            </DrawerDescription>
          </DrawerHeader>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            {phase === "record" || phase === "drafting" ? (
              <>
                <Waveform
                  analyser={stream.analyser}
                  active={stream.status === "listening"}
                  className="h-16 w-full"
                />

                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Transcript
                    </p>
                  </div>
                  {segments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Press “Start recording” and speak — the conversation appears here in real time,
                      labelled per speaker.
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-sm leading-relaxed">
                      {segments.map((s) => (
                        <p key={s.id}>
                          <span className="mr-2 font-medium text-primary">
                            {speakerLabel(s.speakerId, speakerOrder)}:
                          </span>
                          {s.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Clinical facts
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={extracting || segments.length === 0}
                      onClick={() => void runExtraction(transcript.trim())}
                    >
                      {extracting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      Extract now
                    </Button>
                  </div>
                  {facts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Facts are extracted continuously as the conversation develops.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {facts.map((f, i) => (
                        <li key={`${f.group}-${i}`}>
                          <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
                            {f.group}
                          </span>
                          {f.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : null}

            {phase === "review" || phase === "saving" ? (
              draft ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="draft-conclusion">Conclusion</Label>
                    <MarkdownEditor
                      id="draft-conclusion"
                      value={draft.conclusion}
                      onChange={(v) => setDraft({ ...draft, conclusion: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="draft-recommendation">Recommendation</Label>
                    <MarkdownEditor
                      id="draft-recommendation"
                      value={draft.recommendation}
                      onChange={(v) => setDraft({ ...draft, recommendation: v })}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Urgency</Label>
                      <Select
                        value={draft.urgencyLevel}
                        onValueChange={(v) => setDraft({ ...draft, urgencyLevel: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH_RED_FLAG">Red flag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Disposition</Label>
                      <Select
                        value={draft.disposition}
                        onValueChange={(v) => setDraft({ ...draft, disposition: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOME_CARE">Home care</SelectItem>
                          <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
                          <SelectItem value="ER_REFERRAL">ER referral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ChipSection
                    title="Diagnoses"
                    empty="No diagnoses extracted."
                    items={draft.diagnoses.map((d, i) => ({
                      key: String(i),
                      label: d.description,
                      code: d.code,
                      system: "ICD-10",
                    }))}
                    onRemove={(i) =>
                      setDraft({
                        ...draft,
                        diagnoses: draft.diagnoses.filter((_, idx) => idx !== Number(i)),
                      })
                    }
                  />

                  <ChipSection
                    title="Prescriptions"
                    empty="No medications ordered."
                    items={draft.prescriptions.map((p, i) => ({
                      key: String(i),
                      label: [p.drugName, p.dosage, p.frequency].filter(Boolean).join(" · "),
                      code: p.atcCode,
                      system: "ATC",
                    }))}
                    onRemove={(i) =>
                      setDraft({
                        ...draft,
                        prescriptions: draft.prescriptions.filter((_, idx) => idx !== Number(i)),
                      })
                    }
                  />

                  <ChipSection
                    title="Observations"
                    empty="No labs or vitals captured."
                    items={draft.observations.map((o, i) => ({
                      key: String(i),
                      label: [
                        o.testName,
                        o.value != null ? `${o.value}${o.unit ? ` ${o.unit}` : ""}` : null,
                        o.status === "ORDERED" ? "ordered — awaiting result" : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      code: o.loincCode,
                      system: "LOINC",
                    }))}
                    onRemove={(i) =>
                      setDraft({
                        ...draft,
                        observations: draft.observations.filter((_, idx) => idx !== Number(i)),
                      })
                    }
                  />

                  <div className="space-y-2">
                    <Label htmlFor="add-note">Add a note to the conclusion</Label>
                    <Input
                      id="add-note"
                      placeholder="Optional extra line…"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (!value) return;
                        setDraft({ ...draft, conclusion: `${draft.conclusion}\n${value}`.trim() });
                        (e.target as HTMLInputElement).value = "";
                      }}
                    />
                  </div>
                </>
              ) : null
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
            {phase === "record" ? (
              <>
                <Button
                  variant={recording ? "destructive" : "default"}
                  onClick={() => (recording ? stream.stop() : void stream.start())}
                >
                  {recording ? (
                    <>
                      <Square className="size-4" /> Stop recording
                    </>
                  ) : (
                    <>
                      <Mic className="size-4" /> Start recording
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={() => void finishRecording()}>
                  Done
                </Button>
              </>
            ) : null}

            {phase === "drafting" ? (
              <Button disabled>
                <Loader2 className="size-4 animate-spin" /> Drafting the note…
              </Button>
            ) : null}

            {phase === "review" || phase === "saving" ? (
              <>
                <Button variant="ghost" disabled={phase === "saving"} onClick={() => setPhase("record")}>
                  Back to recording
                </Button>
                <Button disabled={phase === "saving"} onClick={() => void confirmAndSign()}>
                  {phase === "saving" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check className="size-4" /> Confirm &amp; sign
                    </>
                  )}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ChipSection({
  title,
  empty,
  items,
  onRemove,
}: {
  title: string;
  empty: string;
  items: { key: string; label: string; code: string | null; system: string }[];
  onRemove: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-sm"
            >
              {item.code ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                  {item.system} {item.code}
                </span>
              ) : null}
              {item.label}
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => onRemove(item.key)}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
