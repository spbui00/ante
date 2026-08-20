import { useEffect, useRef } from "react";

/**
 * Live voice waveform. Draws a smooth sine-like line whose amplitude follows
 * the microphone level; idles as a calm flat ripple when not recording.
 */
export function Waveform({
  analyser,
  active,
  className,
}: {
  analyser: AnalyserNode | null;
  active: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = analyser ? new Uint8Array(analyser.fftSize) : null;
    let frame = 0;
    let phase = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      let target = 0;
      if (analyser && buffer && active) {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i]! - 128) / 128;
          sum += v * v;
        }
        target = Math.min(1, Math.sqrt(sum / buffer.length) * 4);
      }
      levelRef.current += (target - levelRef.current) * 0.18;
      const level = levelRef.current;

      phase += active ? 0.16 : 0.05;

      const styles = getComputedStyle(canvas);
      const stroke = styles.getPropertyValue("--waveform-color").trim() || "currentColor";
      const mid = height / 2;
      const amp = (height / 2 - 3) * (0.08 + level * 0.92);

      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        const layerAmp = amp * (1 - layer * 0.32);
        const speed = 1 + layer * 0.45;
        for (let x = 0; x <= width; x += 2) {
          const t = x / width;
          const envelope = Math.sin(Math.PI * t);
          const y =
            mid +
            Math.sin(t * Math.PI * 6 * speed - phase * speed) * layerAmp * envelope +
            Math.sin(t * Math.PI * 13 - phase * 0.7) * layerAmp * 0.25 * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = stroke;
        ctx.globalAlpha = layer === 0 ? 0.95 : layer === 1 ? 0.45 : 0.2;
        ctx.lineWidth = layer === 0 ? 2.5 : 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, active]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
