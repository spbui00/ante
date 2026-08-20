import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ageBracketFromDob, symptomDurationCategory } from "@/lib/clinical-utils";

const bodySchema = z.object({
  patientId: z.string().uuid(),
  practitionerId: z.string().uuid(),
  transcript: z.string().min(3).max(20000),
  symptomsSummary: z.string().max(4000).default(""),
  conclusion: z.string().max(4000).default(""),
  recommendation: z.string().max(4000).default(""),
  primaryIcd10: z.string().max(16).optional(),
  symptomIcdCodes: z.array(z.string().max(16)).max(20).default([]),
  encounterType: z.enum(["NEW_ISSUE", "FOLLOW_UP", "CHRONIC_FLARE_UP"]).default("NEW_ISSUE"),
  urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH_RED_FLAG"]).default("LOW"),
  disposition: z.enum(["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"]).default("HOME_CARE"),
  symptomDurationDays: z.number().int().min(0).max(3650).nullish(),
});

/**
 * Dual-write endpoint.
 * 1. Identifiable clinical record  -> public.visit
 * 2. De-identified population row  -> public.anonymized_encounter
 *
 * TODO: call Corti Medical Coding for ICD-10/SKS extraction from `transcript`.
 * TODO: call Corti Text Gen for the summary/conclusion/recommendation draft.
 * TODO: replace the deterministic stub embedding with a real 1536-dim embedding.
 */
export const Route = createFileRoute("/api/process-visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return json({ error: "Unauthorized" }, 401);
        }

        let input: z.infer<typeof bodySchema>;
        try {
          input = bodySchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }

        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (i, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", key);
              h.set("Authorization", auth);
              return fetch(i, { ...init, headers: h });
            },
          },
        });

        const { data: user } = await supabase.auth.getUser(auth.slice(7));
        if (!user.user) return json({ error: "Unauthorized" }, 401);

        // --- Write 1: identifiable visit -------------------------------
        const { data: visit, error: visitError } = await supabase
          .from("visit")
          .insert({
            patient_id: input.patientId,
            practitioner_id: input.practitionerId,
            encounter_type: input.encounterType,
            symptoms: input.symptomsSummary,
            conclusion: input.conclusion,
            recommendation: input.recommendation,
            urgency_level: input.urgencyLevel,
            disposition: input.disposition,
            status: "COMPLETED",
            intake_transcript: input.transcript,
            symptom_icd_codes: input.symptomIcdCodes,
          })
          .select("id, visit_date")
          .single();

        if (visitError) return json({ error: visitError.message }, 400);

        // --- Write 2: de-identified population row ---------------------
        const { data: patient } = await supabase
          .from("patient")
          .select("date_of_birth, gender, postal_code, industry")
          .eq("id", input.patientId)
          .maybeSingle();

        const { error: anonError } = await supabase.from("anonymized_encounter").insert({
          encounter_date: visit.visit_date ?? new Date().toISOString(),
          postal_code: patient?.postal_code ?? null,
          age_bracket: ageBracketFromDob(patient?.date_of_birth),
          gender: patient?.gender ?? null,
          industry: patient?.industry ?? null,
          primary_icd_10: input.primaryIcd10 ?? null,
          symptom_icd_codes: input.symptomIcdCodes,
          encounter_type: input.encounterType,
          symptom_duration_category: symptomDurationCategory(input.symptomDurationDays),
          urgency_level: input.urgencyLevel,
          disposition: input.disposition,
        });

        return json({
          ok: true,
          visitId: visit.id,
          anonymizedWrite: anonError ? "failed" : "ok",
        });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
