import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Mock agentic pre-intake.
 * TODO: replace the keyword matcher below with a Corti Agentic Pre-intake call.
 */
const bodySchema = z.object({ transcript: z.string().min(3).max(4000) });

const RULES: { match: RegExp; code: string; label: string; urgent?: boolean }[] = [
  { match: /cough|hoste/i, code: "R05", label: "Cough" },
  { match: /fever|feber|temperature/i, code: "R50.9", label: "Fever, unspecified" },
  { match: /chest pain|brystsmerte/i, code: "R07.4", label: "Chest pain", urgent: true },
  { match: /breath|short of breath|vejrtrækning/i, code: "R06.0", label: "Dyspnoea", urgent: true },
  { match: /headache|hovedpine/i, code: "R51", label: "Headache" },
  { match: /rash|udslæt/i, code: "R21", label: "Rash" },
  { match: /vomit|nausea|kvalme/i, code: "R11", label: "Nausea and vomiting" },
  { match: /diarrh|diarré/i, code: "R19.7", label: "Diarrhoea" },
  { match: /throat|hals/i, code: "R07.0", label: "Throat pain" },
  { match: /dizz|svimmel/i, code: "R42", label: "Dizziness" },
];

export const Route = createFileRoute("/api/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ error: "Invalid request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const hits = RULES.filter((r) => r.match.test(parsed.transcript));
        const urgent = hits.some((h) => h.urgent);

        return Response.json({
          summary: hits.length
            ? `Reported ${hits.map((h) => h.label.toLowerCase()).join(", ")}.`
            : "Symptoms recorded; no red-flag keywords detected in the description.",
          symptoms: hits.map((h) => h.label),
          symptomCodes: hits.map((h) => ({ code: h.code, label: h.label })),
          urgencyLevel: urgent ? "HIGH_RED_FLAG" : hits.length > 1 ? "MEDIUM" : "LOW",
          recommendation: urgent
            ? "Red-flag symptoms detected — seek same-day clinical assessment."
            : "A clinician will review this summary before your consultation.",
        });
      },
    },
  },
});
