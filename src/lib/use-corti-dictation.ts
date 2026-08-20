import { useCallback, useRef, useState } from "react";

type Status = "idle" | "connecting" | "listening" | "stopping";

type Session = {
  socket: WebSocket;
  stream: MediaStream;
  ctx: AudioContext;
  node: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
};

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
 * Real-time dictation over the Corti /transcribe WebSocket.
 * Streams 16 kHz mono PCM while the mic button is held and surfaces
 * interim + final transcript segments as they arrive.
 */
export function useCortiDictation({
  language = "en",
  onFinal,
  onError,
}: {
  language?: string;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [interim, setInterim] = useState("");
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
    setInterim("");

    let stream: MediaStream | null = null;
    try {
      const res = await fetch("/api/stt-session", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start dictation");

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
              primaryLanguage: language,
              interimResults: true,
              automaticPunctuation: true,
              audioFormat: `audio/pcm; rate=${SAMPLE_RATE}; channels=1; bits=16; endian=little; encoding=sint`,
            },
          }),
        );
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let msg: { type?: string; data?: { text?: string; isFinal?: boolean } };
        try {
          msg = JSON.parse(event.data);
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
          onError?.("Dictation configuration was rejected");
          socket.close();
          return;
        }
        if (type === "transcript" && msg.data?.text) {
          if (msg.data.isFinal) {
            setInterim("");
            onFinal(msg.data.text);
          } else {
            setInterim(msg.data.text);
          }
          return;
        }
        if (type === "ended") socket.close();
      };

      socket.onerror = () => onError?.("Dictation connection failed");
      socket.onclose = () => {
        if (sessionRef.current === session) {
          teardown(session);
          sessionRef.current = null;
        }
        setAnalyser(null);
        setInterim("");
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
  }, [language, onError, onFinal, status, teardown]);

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
      // Give the server a moment to emit the trailing final segments.
      setTimeout(() => {
        if (sessionRef.current === session) session.socket.close();
      }, 2500);
    } else {
      session.socket.close();
    }
  }, []);

  return { status, interim, analyser, start, stop };
}
