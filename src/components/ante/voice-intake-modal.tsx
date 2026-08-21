import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Mic, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { stripFollowUpMarker } from "@/lib/clinical-utils";
import { useCortiDictation } from "@/lib/use-corti-dictation";

import { CodeChip, UrgencyBadge } from "@/components/ante/badges";
import { Waveform } from "@/components/ante/waveform";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { createPreIntakeVisit, updatePreIntakeVisit } from "@/lib/intake.functions";
import { sendAgentTurn } from "@/lib/agents/agent.functions";

type IntakeResult = {
  source?: string;
  summary: string;
  symptoms: string[];
  symptomDetail?: string;
  pertinentNegatives?: string[];
  symptomDurationDays?: number | null;
  travelHistory?: string[];
  symptomCodes: { code: string; label: string }[];
  urgencyLevel: string;
  recommendation: string;
  warning?: string;
};

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

export type EditableIntakeVisit = {
  id: string;
  symptoms?: string | null;
  urgency_level?: string | null;
  intake_transcript?: string | null;
  symptom_icd_codes?: string[] | null;
};

const FINALISING_PHRASES = [
  "Filling the intake form…",
  "Structuring your symptoms…",
  "Vitamin D is important, but so do other vitamins…",
  "Matching medical codes…",
  "Do doctors partners avoid apples?",
  "Be patient, you are a patient afterall…",
  "Almost there…",
];

export function VoiceIntakeModal({
  open,
  onOpenChange,
  visit = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When set, the drawer edits this existing SCHEDULED draft instead of creating one. */
  visit?: EditableIntakeVisit | null;
  onSaved?: () => void;
}) {
  const editing = Boolean(visit);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const finishedRef = useRef(false);
  const userTurnsRef = useRef(0);

  const contextId = useRef<string | null>(null);
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDictatingRef = useRef(false);

  const savePreIntake = useServerFn(createPreIntakeVisit);
  const updateIntake = useServerFn(updatePreIntakeVisit);
  const askAgent = useServerFn(sendAgentTurn);

  const dictation = useCortiDictation({
    language: "en",
    onFinal: (text) => setInput((prev) => `${prev} ${text}`.trim()),
    onError: (message) => toast.error(message),
  });

  const recording = dictation.status === "listening";
  const connecting = dictation.status === "connecting";

  const composerValue =
    input + (dictation.interim ? (input ? " " : "") + dictation.interim : "");

  function resetAll() {
    setMessages([]);
    setInput("");
    setResult(null);
    setConfirmOpen(false);
    finishedRef.current = false;
    userTurnsRef.current = 0;

    contextId.current = null;
  }

  const finishRef = useRef<(() => Promise<void>) | null>(null);
  const cancelledRef = useRef(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!analysing) {
      setPhraseIndex(0);
      return;
    }
    const id = setInterval(
      () => setPhraseIndex((i) => (i + 1) % FINALISING_PHRASES.length),
      4200,
    );
    return () => clearInterval(id);
  }, [analysing]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text: trimmed },
    ]);
    setInput("");
    setThinking(true);
    try {
      const priming =
        editing && !contextId.current
          ? [
              "### EXISTING PRE-INTAKE DRAFT",
              visit?.symptoms ? `Recorded symptoms:\n${visit.symptoms}` : "",
              visit?.urgency_level ? `Urgency: ${visit.urgency_level}` : "",
              visit?.symptom_icd_codes?.length
                ? `Codes: ${visit.symptom_icd_codes.join(", ")}`
                : "",
              stripFollowUpMarker(visit?.intake_transcript)
                ? `\n### PREVIOUS CONVERSATION TRANSCRIPT\n${stripFollowUpMarker(visit?.intake_transcript)}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : "";

      const res = await askAgent({
        data: {
          agentKey: editing ? "intake-edit" : "intake",
          text: priming ? `${priming}\n\n### PATIENT SAYS\n${trimmed}` : trimmed,
          contextId: contextId.current,
        },
      });
      contextId.current = res.contextId ?? contextId.current;
      userTurnsRef.current += 1;
      // In edit mode the model sees a complete transcript and tends to finish
      // immediately — require at least two patient turns before honouring it.
      const minTurns = editing ? 2 : 1;
      const done =
        res.reply.includes("[INTAKE_COMPLETE]") && userTurnsRef.current >= minTurns;
      const cleaned = res.reply.replace(/\[INTAKE_COMPLETE\]/g, "").trim();
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: cleaned },
      ]);
      if (done && !finishedRef.current) {
        finishedRef.current = true;
        setTimeout(() => void finishRef.current?.(), 400);
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The assistant is unavailable");
    } finally {
      setThinking(false);
    }
  }, [thinking, askAgent, editing, visit]);

  useEffect(() => {
    const isDictating = recording || connecting || dictation.status === "stopping";

    if (isDictating || thinking) {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
      if (isDictating) wasDictatingRef.current = true;
      return;
    }

    if (wasDictatingRef.current && composerValue.trim()) {
      if (autoSendTimeoutRef.current) clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = setTimeout(() => {
        autoSendTimeoutRef.current = null;
        wasDictatingRef.current = false;
        if (composerValue.trim() && !thinking) {
          void send(composerValue);
        }
      }, 1500);
    } else if (!composerValue.trim() && autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }

    return () => {
      if (autoSendTimeoutRef.current) clearTimeout(autoSendTimeoutRef.current);
    };
  }, [recording, connecting, dictation.status, composerValue, thinking, send]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const enoughData =
    finishedRef.current || (userTurns >= 3 && (result?.symptoms.length ?? 0) > 0);

  const conversationText = [
    editing ? stripFollowUpMarker(visit?.intake_transcript) : "",
    messages
      .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.text}`)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  async function finish() {
    if (!messages.some((m) => m.role === "user")) {
      toast.error("Describe your symptoms first");
      return;
    }
    cancelledRef.current = false;
    setAnalysing(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: conversationText, language: "en" }),
      });
      if (!res.ok) throw new Error("Intake failed");
      const data = (await res.json()) as IntakeResult;
      if (cancelledRef.current) return;
      setResult(data);
      setConfirmOpen(true);
      if (data.warning) toast.warning("Corti unavailable — showing a basic summary");
    } catch {
      if (!cancelledRef.current) toast.error("Could not process intake");
    } finally {
      setAnalysing(false);
    }
  }

  useEffect(() => {
    finishRef.current = finish;
  });

  async function sendToClinic() {
    if (!result) return;
    setSaving(true);
    try {
      const payload = {
          transcript: conversationText,
          symptoms:
            [
              (/^\s*(patient|assistant)\s*:/im.test(result.symptomDetail ?? "")
                ? ""
                : result.symptomDetail?.trim()) ||
                result.symptoms.join(", ") ||
                result.summary,
              result.pertinentNegatives?.length
                ? `Denies: ${result.pertinentNegatives.join(", ")}.`
                : "",
            ]
              .filter(Boolean)
              .join("\n\n") || result.summary,
          symptomIcdCodes: result.symptomCodes.map((c) => c.code),
          urgencyLevel:
            (result.urgencyLevel as "LOW" | "MEDIUM" | "HIGH_RED_FLAG") ?? "LOW",
          travelHistory: result.travelHistory ?? [],
          symptomDurationDays: result.symptomDurationDays ?? null,
      };

      if (editing && visit) {
        await updateIntake({ data: { ...payload, visitId: visit.id } });
      } else {
        await savePreIntake({ data: { ...payload, recommendation: "" } });
      }
      onSaved?.();
      toast.success(
        editing
          ? "Pre-intake updated — your clinician will see the latest version"
          : "Pre-intake sent — your clinician will see it at check-in",
      );
      setConfirmOpen(false);
      onOpenChange(false);
      resetAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save pre-intake");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Drawer
      open={open}
      dismissible={!analysing}
      onOpenChange={(v) => {
        if (analysing && !v) return;
        onOpenChange(v);
      }}
    >

      <DrawerContent className="max-h-[88dvh]">
        <div
          aria-hidden={analysing}
          className={`mx-auto flex h-full max-h-[84dvh] w-full max-w-md flex-col px-4 pb-6 ${
            analysing ? "pointer-events-none select-none" : ""
          }`}
        >
          <DrawerHeader className="px-0 pb-2 text-left">
            <DrawerTitle className="text-2xl">
              {editing ? "Update your intake" : "Tell us what's wrong"}
            </DrawerTitle>
            <DrawerDescription>
              {editing
                ? "Tell Ante what changed — it already knows what you shared before."
                : "Speak naturally — Ante will ask a few follow-up questions before your visit."}
            </DrawerDescription>
          </DrawerHeader>

          <Conversation className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-secondary/40">
            <ConversationContent className="gap-4 p-3">
              {messages.length === 0 && !thinking ? (
                <ConversationEmptyState
                  title="No messages yet"
                  description="Hold the mic or type to describe how you're feeling."
                />
              ) : null}

              {messages.map((m) => (
                <Message from={m.role} key={m.id}>
                  <MessageContent>
                    <MessageResponse>{m.text}</MessageResponse>
                  </MessageContent>
                </Message>
              ))}

              {thinking ? (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Thinking…</Shimmer>
                  </MessageContent>
                </Message>
              ) : null}

              {result ? (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-2xl border border-border bg-card p-4 text-left text-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-foreground">Draft pre-intake ready</span>
                    <UrgencyBadge level={result.urgencyLevel} />
                  </div>
                  <p className="text-muted-foreground">
                    {result.symptomDetail || result.summary}
                  </p>
                  <p className="mt-2 text-xs text-primary">Tap to review and submit</p>
                </button>
              ) : null}

            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {recording || connecting ? (
            <Waveform
              analyser={dictation.analyser}
              active={recording}
              className="mt-3 h-12 w-full text-primary"
            />
          ) : null}

          <PromptInput
            className="mt-3"
            onSubmit={(_message, event) => {
              event.preventDefault();
              void send(composerValue);
            }}
          >
            <PromptInputTextarea
              placeholder="e.g. Dry cough for four days, fever last night."
              value={composerValue}
              onChange={(e) => {
                const raw = e.target.value;
                if (!dictation.interim) {
                  setInput(raw);
                  return;
                }
                const suffix = (input ? " " : "") + dictation.interim;
                setInput(raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw);
              }}
            />
            <PromptInputFooter>
              <PromptInputTools>
                <button
                  type="button"
                  onClick={() => {
                    if (recording) dictation.stop();
                    else if (!connecting) void dictation.start();
                  }}
                  aria-pressed={recording}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                  className={`grid size-9 touch-none select-none place-items-center rounded-full text-primary-foreground transition-transform active:scale-95 ${
                    recording ? "bg-destructive scale-105" : "bg-primary"
                  }`}
                >
                  {connecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void finish()}
                  disabled={analysing || thinking}
                >
                  {analysing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Finish
                </Button>
              </PromptInputTools>
              <PromptInputSubmit
                {...(thinking ? { status: "submitted" as const } : {})}
                disabled={thinking || !composerValue.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>

        {analysing ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-[inherit] bg-background/85 px-6 text-center backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p
              key={phraseIndex}
              className="animate-in fade-in text-lg font-medium text-foreground"
            >
              {FINALISING_PHRASES[phraseIndex]}
            </p>
            <p className="text-sm text-muted-foreground">
              (please don't close this)
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                cancelledRef.current = true;
                setAnalysing(false);
              }}
            >
              Cancel intake
            </Button>
          </div>
        ) : null}
      </DrawerContent>
      </Drawer>

      <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>

        <DrawerContent className="max-h-[85dvh]">
          <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-6">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="text-xl">
                {editing ? "Update your pre-intake?" : "Submit your pre-intake?"}
              </DrawerTitle>
              <DrawerDescription>
                Your clinician will see this at check-in. No treatment advice is recorded —
                that comes from your doctor at the visit.
              </DrawerDescription>
            </DrawerHeader>

            {enoughData ? null : (
              <div className="mb-3 flex gap-2 rounded-2xl border border-border bg-secondary/50 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-muted-foreground">
                  We may not have enough detail yet. Answering a few more questions helps your
                  doctor — but you can still submit now.
                </p>
              </div>
            )}

            {result ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-foreground">Symptom summary</span>
                  <UrgencyBadge level={result.urgencyLevel} />
                </div>
                {result.symptomDetail ? (
                  <p className="text-foreground">{result.symptomDetail}</p>
                ) : result.symptoms.length ? (
                  <p className="text-foreground">{result.symptoms.join(", ")}</p>
                ) : null}
                {result.pertinentNegatives?.length ? (
                  <p className="mt-2 text-muted-foreground">
                    Denies: {result.pertinentNegatives.join(", ")}.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1">
                  {result.symptomCodes.map((c) => (
                    <CodeChip key={c.code} code={c.code} system="ICD-10" />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmOpen(false)}
              >
                Keep talking
              </Button>
              <Button className="flex-1" onClick={sendToClinic} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Submit
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>

  );
}

