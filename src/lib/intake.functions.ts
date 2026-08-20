import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Step 4 of the Corti pre-intake pipeline: prefill a VISIT row for the
 * signed-in patient with status SCHEDULED and no practitioner assigned yet.
 */
export const createPreIntakeVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        transcript: z.string().min(3).max(20000),
        symptoms: z.string().max(4000).default(""),
        symptomIcdCodes: z.array(z.string().max(16)).max(20).default([]),
        urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH_RED_FLAG"]).default("LOW"),
        recommendation: z.string().max(4000).default(""),
        travelHistory: z.array(z.string().max(120)).max(10).default([]),
        symptomDurationDays: z.number().int().min(0).max(3650).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.patient_id) throw new Error("No patient record linked to this account");

    const { data: visit, error } = await supabase
      .from("visit")
      .insert({
        patient_id: profile.patient_id,
        practitioner_id: null,
        status: "SCHEDULED",
        encounter_type: "NEW_ISSUE",
        is_ai_generated: true,
        intake_transcript: data.transcript,
        symptoms: data.symptoms,
        symptom_icd_codes: data.symptomIcdCodes,
        urgency_level: data.urgencyLevel,
        recommendation: data.recommendation,
        travel_history: data.travelHistory,
        symptom_duration_days: data.symptomDurationDays ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, visitId: visit.id };
  });
