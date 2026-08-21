import { useCallback, useRef, useState } from "react";

type Status = "idle" | "connecting" | "listening" | "stopping";

type Session = {
  socket: WebSocket;
  stream: MediaStream;
  ctx: AudioContext;
  node: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
};

export type StreamSegment = { id: string; text: string; speakerId: number };
export type StreamFact = { id?: string; group: string; text: string };

const SAMPLE_RATE = 16000;

function toPcm16(input: Float32Array) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/**
 * Ambient consultation streaming over the Corti /streams WebSocket.
 * Streams 16 kHz mono PCM and surfaces diarized transcript segments
 * (who spoke) plus FactsR clinical facts in real time.
 */
export function useCortiStream({
  language = "en",
  visitId,
  onSegment,
  onFacts,
  onError,
}: {
  language?: string;
  visitId?: string;
  onSegment: (segment: StreamSegment) => void;
  onFacts: (facts: StreamFact[]) => void;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const teardown = useCallback((session: Session | null) => {
    if (!session) return;
    session.stream.getTracks().forEach((t) => t.stop());
    try {
      session.node.disconnect();
      session.source.disconnect();
    } catch {
      /* already disconnected */
    }
    void session.ctx.close().catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    if (sessionRef.current || status === "connecting") return;
    setStatus("connecting");

    let stream: MediaStream | null = null;
    try {
      const res = await fetch("/api/stream-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: visitId ?? null }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start recording");

      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: true },
      });

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const meter = ctx.createAnalyser();
      meter.fftSize = 1024;
      source.connect(meter);

      const socket = new WebSocket(data.url);
      socket.binaryType = "arraybuffer";

      const session: Session = { socket, stream, ctx, node, source };
      sessionRef.current = session;

      let ready = false;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: "config",
            configuration: {
              transcription: {
                primaryLanguage: language,
                diarize: true,
                isMultichannel: false,
                participants: [{ channel: 0, role: "multiple" }],
              },
              mode: {
                type: "facts",
                outputLocale: language,
                factGenerationInterval: "fast_init",
              },
              audioFormat: `audio/pcm; rate=${SAMPLE_RATE}; channels=1; bits=16; endian=little; encoding=sint`,
            },
          }),
        );
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let msg: {
          type?: string;
          data?: unknown;
          fact?: unknown;
          facts?: unknown;
          error?: unknown;
        };
        try {
          msg = JSON.parse(event.data) as typeof msg;
        } catch {
          return;
        }

        const type = msg.type;
        if (type === "CONFIG_ACCEPTED") {
          ready = true;
          setStatus("listening");
          return;
        }
        if (type === "CONFIG_DENIED" || type === "CONFIG_REJECTED" || type === "error") {
          const detail =
            typeof msg.error === "string"
              ? msg.error
              : ((msg.error as { title?: string } | undefined)?.title ??
                "Recording configuration was rejected");
          onError?.(detail);
          socket.close();
          return;
        }
        if (type === "transcript") {
          const items = Array.isArray(msg.data) ? msg.data : [];
          for (const raw of items as {
            id?: string;
            transcript?: string;
            text?: string;
            final?: boolean;
            speakerId?: number;
          }[]) {
            const text = (raw.transcript ?? raw.text ?? "").trim();
            if (!text) continue;
            onSegment({
              id: raw.id ?? `${Date.now()}-${Math.random()}`,
              text,
              speakerId: typeof raw.speakerId === "number" ? raw.speakerId : -1,
            });
          }
          return;
        }
        if (type === "facts") {
          const list = (Array.isArray(msg.fact) ? msg.fact : msg.facts) as
            | { id?: string; text?: string; group?: string; isDiscarded?: boolean }[]
            | undefined;
          if (!Array.isArray(list)) return;
          const facts = list
            .filter((f) => f.text && !f.isDiscarded)
            .map((f) => ({
              ...(f.id ? { id: f.id } : {}),
              group: f.group ?? "fact",
              text: String(f.text),
            }));
          if (facts.length) onFacts(facts);
          return;
        }
        if (type === "ENDED" || type === "ended") socket.close();
      };

      socket.onerror = () => onError?.("Recording connection failed");
      socket.onclose = () => {
        if (sessionRef.current === session) {
          teardown(session);
          sessionRef.current = null;
        }
        setAnalyser(null);
        setStatus("idle");
      };

      node.onaudioprocess = (e) => {
        if (!ready || socket.readyState !== WebSocket.OPEN) return;
        socket.send(toPcm16(new Float32Array(e.inputBuffer.getChannelData(0))));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setAnalyser(meter);
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop());
      sessionRef.current = null;
      setStatus("idle");
      setAnalyser(null);
      onError?.(error instanceof Error ? error.message : "Microphone unavailable");
    }
  }, [language, onError, onFacts, onSegment, status, teardown, visitId]);

  /** Forces the server to emit pending transcript segments and facts. */
  const flush = useCallback(() => {
    const socket = sessionRef.current?.socket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "flush" }));
  }, []);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setStatus("stopping");
    try {
      session.node.disconnect();
      session.source.disconnect();
    } catch {
      /* noop */
    }
    if (session.socket.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify({ type: "flush" }));
      session.socket.send(JSON.stringify({ type: "end" }));
      // Give the server a moment to emit trailing segments and facts.
      setTimeout(() => {
        if (sessionRef.current === session) session.socket.close();
      }, 4000);
    } else {
      session.socket.close();
    }
  }, []);

  return { status, analyser, start, stop, flush };
}
