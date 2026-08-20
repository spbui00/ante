import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
import { createPreIntakeVisit } from "@/lib/intake.functions";
import { sendAgentTurn } from "@/lib/agents/agent.functions";

type IntakeResult = {
  source?: string;
  summary: string;
  symptoms: string[];
  symptomCodes: { code: string; label: string }[];
  urgencyLevel: string;
  recommendation: string;
  warning?: string;
};

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

export function VoiceIntakeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const finishedRef = useRef(false);
  const contextId = useRef<string | null>(null);
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDictatingRef = useRef(false);

  const savePreIntake = useServerFn(createPreIntakeVisit);
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
    contextId.current = null;
  }

  const finishRef = useRef<(() => Promise<void>) | null>(null);

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
      const res = await askAgent({
        data: { agentKey: "intake", text: trimmed, contextId: contextId.current },
      });
      contextId.current = res.contextId ?? contextId.current;
      const done = res.reply.includes("[INTAKE_COMPLETE]");
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
  }, [thinking, askAgent]);

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

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.text}`)
    .join("\n");

  async function finish() {
    if (!messages.some((m) => m.role === "user")) {
      toast.error("Describe your symptoms first");
      return;
    }
    setAnalysing(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: conversationText, language: "en" }),
      });
      if (!res.ok) throw new Error("Intake failed");
      const data = (await res.json()) as IntakeResult;
      setResult(data);
      setConfirmOpen(true);
      if (data.warning) toast.warning("Corti unavailable — showing a basic summary");
    } catch {
      toast.error("Could not process intake");
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
      await savePreIntake({
        data: {
          transcript: conversationText,
          symptoms: result.symptoms.join(", ") || result.summary,
          symptomIcdCodes: result.symptomCodes.map((c) => c.code),
          urgencyLevel:
            (result.urgencyLevel as "LOW" | "MEDIUM" | "HIGH_RED_FLAG") ?? "LOW",
          recommendation: "",
          travelHistory: [],
        },
      });
      toast.success("Pre-intake sent — your clinician will see it at check-in");
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <div className="mx-auto flex h-full max-h-[84dvh] w-full max-w-md flex-col px-4 pb-6">
          <DrawerHeader className="px-0 pb-2 text-left">
            <DrawerTitle className="text-2xl">Tell us what's wrong</DrawerTitle>
            <DrawerDescription>
              Speak naturally — Ante will ask a few follow-up questions before your visit.
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
                  <p className="text-muted-foreground">{result.summary}</p>
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
                  onClick={analyse}
                  disabled={analysing || thinking}
                >
                  {analysing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Summarise
                </Button>
              </PromptInputTools>
              <PromptInputSubmit
                {...(thinking ? { status: "submitted" as const } : {})}
                disabled={thinking || !composerValue.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
