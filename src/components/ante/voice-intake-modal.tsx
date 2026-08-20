import { useRef, useState } from "react";
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
  const contextId = useRef<string | null>(null);

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
    contextId.current = null;
  }

  async function send(text: string) {
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
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: res.reply },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The assistant is unavailable");
    } finally {
      setThinking(false);
    }
  }

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.text}`)
    .join("\n");

  async function analyse() {
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
      if (data.warning) toast.warning("Corti unavailable — showing a basic summary");
    } catch {
      toast.error("Could not process intake");
    } finally {
      setAnalysing(false);
    }
  }

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
          recommendation: result.recommendation,
          travelHistory: [],
        },
      });
      toast.success("Pre-intake sent — your clinician will see it at check-in");
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
                <div className="rounded-2xl border border-border bg-card p-4 text-sm">
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
                  <p className="mt-3 text-muted-foreground">{result.recommendation}</p>
                  <Button className="mt-3 w-full" onClick={sendToClinic} disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Send to clinic
                  </Button>
                </div>
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
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    void dictation.start();
                  }}
                  onPointerUp={() => dictation.stop()}
                  onPointerCancel={() => dictation.stop()}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label="Hold to talk"
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
