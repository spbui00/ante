import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Mints a Corti /streams WebSocket URL for an ambient consultation.
 * Unlike /transcribe (stateless dictation) this endpoint supports speaker
 * diarization and real-time FactsR extraction, so the doctor sees who said
 * what plus live clinical facts while the consultation runs.
 */
const bodySchema = z.object({
  visitId: z.string().max(100).optional(),
  patientIdentifier: z.string().max(100).optional(),
});

export const Route = createFileRoute("/api/stream-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = bodySchema.parse(await request.json().catch(() => ({})));
          const { createStreamInteraction } = await import("@/lib/corti.server");
          const session = await createStreamInteraction({
            identifier: body.visitId ?? `ante-visit-${Date.now()}`,
            title: "Ante ambient consultation",
            ...(body.patientIdentifier ? { patientIdentifier: body.patientIdentifier } : {}),
          });
          return Response.json(session);
        } catch (error) {
          console.error("Corti ambient session failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not start recording" },
            { status: 502 },
          );
        }
      },
    },
  },
});
