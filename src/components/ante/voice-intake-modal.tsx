import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { toast } from "sonner";

import { CodeChip, UrgencyBadge } from "@/components/ante/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Encode captured PCM as a 16-bit mono WAV so every browser uploads a decodable file. */
function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function VoiceIntakeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const audioRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

  const savePreIntake = useServerFn(createPreIntakeVisit);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      audioRef.current = { stream, ctx, node, source, chunks };
      setRecording(true);
      toast.info("Listening — describe your symptoms");
    } catch {
      toast.error("Microphone unavailable. You can type instead.");
    }
  }

  async function stopRecording() {
    const rec = audioRef.current;
    audioRef.current = null;
    setRecording(false);
    if (!rec) return;

    rec.stream.getTracks().forEach((t) => t.stop());
    rec.node.disconnect();
    rec.source.disconnect();
    const blob = encodeWav(rec.chunks, rec.ctx.sampleRate);
    await rec.ctx.close();

    if (blob.size < 4096) {
      toast.error("That recording was empty — please try again.");
      return;
    }

    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      form.append("language", "en");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");
      setTranscript((prev) => `${prev} ${data.transcript ?? ""}`.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transcribe audio");
    } finally {
      setTranscribing(false);
    }
  }

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tell us what's wrong</DialogTitle>
          <DialogDescription>
            Speak or type. Ante prepares a structured summary for your clinician.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          <div className="relative">
            {recording ? (
              <span className="ante-pulse-ring absolute inset-0 rounded-full bg-accent" />
            ) : null}
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              aria-label={recording ? "Stop recording" : "Start recording"}
              className="relative grid size-20 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
            >
              {transcribing ? (
                <Loader2 className="size-7 animate-spin" />
              ) : recording ? (
                <Square className="size-7" />
              ) : (
                <Mic className="size-8" />
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {transcribing
              ? "Transcribing…"
              : recording
                ? "Recording… tap to stop"
                : "Tap to start recording"}
          </p>
        </div>

        <Textarea
          rows={4}
          placeholder="e.g. Dry cough for four days, fever last night, chest feels tight."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />

        <Button onClick={submit} disabled={submitting || transcribing}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Submit pre-intake
        </Button>

        {result ? (
          <div className="rounded-md border border-border bg-secondary p-3 text-sm">
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
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Send to clinic
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
