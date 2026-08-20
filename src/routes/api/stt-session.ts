import { createFileRoute } from "@tanstack/react-router";

/**
 * Mints a short-lived Corti WebSocket URL for real-time dictation.
 * The client streams raw PCM to /audio-bridge/v2/transcribe and receives
 * interim + final transcript segments as they are recognised.
 */
export const Route = createFileRoute("/api/stt-session")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { getCortiToken, CORTI_ENVIRONMENT, CORTI_TENANT } = await import(
            "@/lib/corti.server"
          );
          const token = await getCortiToken();
          const url = `wss://api.${CORTI_ENVIRONMENT}.corti.app/audio-bridge/v2/transcribe?tenant-name=${encodeURIComponent(
            CORTI_TENANT,
          )}&token=${encodeURIComponent(`Bearer ${token}`)}`;
          return Response.json({ url });
        } catch (error) {
          console.error("Corti stream session failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not start dictation" },
            { status: 502 },
          );
        }
      },
    },
  },
});
