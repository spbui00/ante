import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

type IntakeResult = {
  summary: string;
  symptoms: string[];
  symptomCodes: { code: string; label: string }[];
  urgencyLevel: string;
  recommendation: string;
};

export function VoiceIntakeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      toast.info("Listening — describe your symptoms");
    } catch {
      toast.error("Microphone unavailable. You can type instead.");
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
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error("Intake failed");
      setResult((await res.json()) as IntakeResult);
    } catch {
      toast.error("Could not process intake");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
              onClick={toggleRecording}
              aria-label={recording ? "Stop recording" : "Start recording"}
              className="relative grid size-20 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              {recording ? <Square className="size-7" /> : <Mic className="size-8" />}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {recording ? "Recording… tap to stop" : "Tap to start recording"}
          </p>
        </div>

        <Textarea
          rows={4}
          placeholder="e.g. Dry cough for four days, fever last night, chest feels tight."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />

        <Button onClick={submit} disabled={submitting}>
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
            <p className="mt-3 text-muted-foreground">{result.recommendation}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
