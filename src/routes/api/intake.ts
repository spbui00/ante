import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Agentic pre-intake, powered by Corti.
 *  - /tools/extract-facts  -> structured clinical facts
 *  - Corti Models          -> summary, urgency, follow-up questions
 *  - /tools/coding         -> canonical ICD-10 (SKS) symptom codes
 *
 * If Corti is unavailable the endpoint degrades to a keyword matcher so the
 * intake flow still produces something reviewable.
 */
const bodySchema = z.object({
  transcript: z.string().min(3).max(20000),
  language: z.string().max(10).optional(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).max(20).optional(),
});

const FALLBACK_RULES: { match: RegExp; code: string; label: string; urgent?: boolean }[] = [
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

function patientOnly(transcript: string) {
  const lines = transcript
    .split("\n")
    .filter((l) => /^patient:/i.test(l.trim()))
    .map((l) => l.replace(/^\s*patient:\s*/i, "").trim())
    .filter(Boolean);
  const text = (lines.length ? lines.join(" ") : transcript).trim();
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

function fallback(transcript: string) {
  const hits = FALLBACK_RULES.filter((r) => r.match.test(transcript));
  const urgent = hits.some((h) => h.urgent);
  return {
    source: "fallback" as const,
    summary: hits.length
      ? `Reported ${hits.map((h) => h.label.toLowerCase()).join(", ")}.`
      : "Symptoms recorded; no red-flag keywords detected in the description.",
    symptoms: hits.map((h) => h.label),
    symptomDetail: patientOnly(transcript),
    pertinentNegatives: [] as string[],
    symptomDurationDays: null as number | null,
    travelHistory: [] as string[],
    symptomCodes: hits.map((h) => ({ code: h.code, label: h.label })),
    facts: [] as { group: string; text: string }[],
    followUpQuestions: [] as string[],
    urgencyLevel: urgent ? "HIGH_RED_FLAG" : hits.length > 1 ? "MEDIUM" : "LOW",
    recommendation: urgent
      ? "Red-flag symptoms detected — seek same-day clinical assessment."
      : "A clinician will review this summary before your consultation.",
  };
}

const SYSTEM_PROMPT = `You are a clinical pre-intake assistant for a Danish primary-care service.
From the patient's own words and the extracted clinical facts, respond with STRICT JSON only:
{"summary": string, "symptoms": string[], "symptomDetail": string, "pertinentNegatives": string[], "symptomDurationDays": number|null, "travelHistory": string[], "followUpQuestions": string[], "urgencyLevel": "LOW"|"MEDIUM"|"HIGH_RED_FLAG", "recommendation": string}
summary: 1-3 neutral clinical sentences written for the reviewing clinician.
symptoms: short symptom labels for every symptom the patient reported (present symptoms only).
symptomDetail: one compact clinical narrative of the presenting complaint covering every symptom, onset/duration, severity, progression, aggravating/relieving factors, exposures, and explicitly denied symptoms. Include everything the patient said — do not drop details.
pertinentNegatives: symptoms the patient explicitly denied (e.g. "no fever").
symptomDurationDays: duration in days if stated, else null.
travelHistory: recent travel or exposure mentions, empty array if none/denied.
followUpQuestions: up to 4 targeted questions about missing clinical features (onset, duration, travel, red flags). Empty if nothing material is missing.
urgencyLevel: HIGH_RED_FLAG only for potential emergencies (chest pain, breathing difficulty, neurological deficit, sepsis signs).
Never diagnose or prescribe.`;

export const Route = createFileRoute("/api/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const answered = (parsed.answers ?? [])
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n");
        const input = answered ? `${parsed.transcript}\n\n${answered}` : parsed.transcript;

        try {
          const { extractFacts, cortiChat, predictCodes, CORTI_CODING_SYSTEM } = await import(
            "@/lib/corti.server"
          );

          const facts = await extractFacts(input, parsed.language ?? "en").catch(() => []);
          const factLines = facts.map((f) => `- [${f.group}] ${f.text}`).join("\n");

          const raw = await cortiChat({
            system: SYSTEM_PROMPT,
            user: `Patient description:\n${input}\n\nExtracted facts:\n${factLines || "(none)"}`,
          });

          const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
          const gen = JSON.parse(jsonText) as {
            summary?: string;
            symptoms?: string[];
            symptomDetail?: string;
            pertinentNegatives?: string[];
            symptomDurationDays?: number | null;
            travelHistory?: string[];
            followUpQuestions?: string[];
            urgencyLevel?: string;
            recommendation?: string;
          };

          const codingText = [
            gen.summary ?? "",
            gen.symptomDetail ?? "",
            gen.pertinentNegatives?.length ? `Denies: ${gen.pertinentNegatives.join(", ")}.` : "",
            factLines,
          ]
            .filter(Boolean)
            .join("\n");

          const codes = await predictCodes(codingText || input, [CORTI_CODING_SYSTEM]).catch(
            (err) => {
              console.error("Corti coding failed", err);
              return [];
            },
          );

          return Response.json({
            source: "corti",
            summary: gen.summary ?? "",
            symptoms: gen.symptoms ?? [],
            symptomDetail: gen.symptomDetail ?? "",
            pertinentNegatives: gen.pertinentNegatives ?? [],
            symptomDurationDays:
              typeof gen.symptomDurationDays === "number" ? gen.symptomDurationDays : null,
            travelHistory: Array.isArray(gen.travelHistory) ? gen.travelHistory.slice(0, 10) : [],
            facts,
            followUpQuestions: (gen.followUpQuestions ?? []).slice(0, 4),
            symptomCodes: codes.slice(0, 8).map((c) => ({ code: c.code, label: c.display })),
            urgencyLevel: ["LOW", "MEDIUM", "HIGH_RED_FLAG"].includes(gen.urgencyLevel ?? "")
              ? gen.urgencyLevel
              : "LOW",
            recommendation:
              gen.recommendation ?? "A clinician will review this summary before your consultation.",
          });
        } catch (error) {
          console.error("Corti pre-intake failed", error);
          return Response.json({
            ...fallback(input),
            warning: error instanceof Error ? error.message : "Corti unavailable",
          });
        }
      },
    },
  },
});
