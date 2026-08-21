import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Live clinical facts from the running consultation transcript (Corti extract-facts). */
export const extractConsultationFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ transcript: z.string().min(10).max(40000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { extractFacts } = await import("@/lib/corti.server");
    const facts = await extractFacts(data.transcript, "en").catch(() => []);
    return { facts };
  });

const DRAFT_SYSTEM = `You are a medical scribe for a Danish primary-care clinic.
Read the consultation transcript and the extracted clinical facts, then respond with STRICT JSON only:
{"conclusion": string, "recommendation": string, "diagnoses": [{"description": string, "code": string|null, "status": "ACTIVE"|"RESOLVED"|"SUSPECTED"}], "prescriptions": [{"drugName": string, "atcCode": string|null, "dosage": string|null, "frequency": string|null}], "observations": [{"testName": string, "loincCode": string|null, "value": number|null, "unit": string|null, "status": "ORDERED"|"RESULTED"}], "urgencyLevel": "LOW"|"MEDIUM"|"HIGH_RED_FLAG", "disposition": "HOME_CARE"|"PRESCRIPTION"|"ER_REFERRAL"}
conclusion: concise clinical summary of the findings (2-5 sentences).
recommendation: the plan — treatments, follow-up, safety-netting.
diagnoses: only conditions the clinician actually confirmed or suspected in the conversation; ICD-10 code when confident, else null.
prescriptions: only medications the clinician verbally ordered, with ATC code when confident.
observations: vitals or labs mentioned or ordered, with LOINC code when confident; numeric value when stated. Use status "ORDERED" (value null) for tests the clinician orders for later, "RESULTED" when a value was measured during the visit.
Never invent findings that are not supported by the transcript. Empty arrays are fine.`;

/** Turns the finished consultation into an editable structured draft. */
export const draftConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        transcript: z.string().min(10).max(40000),
        facts: z.array(z.object({ group: z.string(), text: z.string() })).max(200).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { cortiChat, predictCodes, CORTI_CODING_SYSTEM } = await import("@/lib/corti.server");

    const factLines = data.facts.map((f) => `- [${f.group}] ${f.text}`).join("\n");
    const raw = await cortiChat({
      system: DRAFT_SYSTEM,
      user: `Consultation transcript:\n${data.transcript}\n\nExtracted facts:\n${factLines || "(none)"}`,
    });

    let gen: Record<string, unknown> = {};
    try {
      gen = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      gen = {};
    }

    const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const conclusion = typeof gen["conclusion"] === "string" ? (gen["conclusion"] as string) : "";
    const recommendation =
      typeof gen["recommendation"] === "string" ? (gen["recommendation"] as string) : "";

    const diagnoses = asArray<{ description?: string; code?: string | null; status?: string }>(
      gen["diagnoses"],
    )
      .filter((d) => d.description)
      .map((d) => ({
        description: String(d.description),
        code: d.code ?? null,
        status: (["ACTIVE", "RESOLVED", "SUSPECTED"] as const).includes(d.status as never)
          ? (d.status as "ACTIVE" | "RESOLVED" | "SUSPECTED")
          : ("ACTIVE" as const),
      }));

    // Canonical ICD-10 predictions from Corti coding, used to fill missing codes.
    const codes = await predictCodes(
      [conclusion, diagnoses.map((d) => d.description).join(", ")].filter(Boolean).join("\n") ||
        data.transcript,
      [CORTI_CODING_SYSTEM],
    ).catch(() => []);

    const enriched = diagnoses.map((d) => {
      if (d.code) return d;
      const hit = codes.find(
        (c) =>
          c.display.toLowerCase().includes(d.description.toLowerCase()) ||
          d.description.toLowerCase().includes(c.display.toLowerCase()),
      );
      return { ...d, code: hit?.code ?? null };
    });

    return {
      conclusion,
      recommendation,
      diagnoses: enriched,
      prescriptions: asArray<{
        drugName?: string;
        atcCode?: string | null;
        dosage?: string | null;
        frequency?: string | null;
      }>(gen["prescriptions"])
        .filter((p) => p.drugName)
        .map((p) => ({
          drugName: String(p.drugName),
          atcCode: p.atcCode ?? null,
          dosage: p.dosage ?? null,
          frequency: p.frequency ?? null,
        })),
      observations: asArray<{
        testName?: string;
        loincCode?: string | null;
        value?: number | null;
        unit?: string | null;
        status?: string | null;
      }>(gen["observations"])
        .filter((o) => o.testName)
        .map((o) => ({
          testName: String(o.testName),
          loincCode: o.loincCode ?? null,
          value: typeof o.value === "number" ? o.value : null,
          unit: o.unit ?? null,
          status: (o.status === "ORDERED" ? "ORDERED" : "RESULTED") as "ORDERED" | "RESULTED",
        })),
      urgencyLevel: (["LOW", "MEDIUM", "HIGH_RED_FLAG"] as const).includes(
        gen["urgencyLevel"] as never,
      )
        ? (gen["urgencyLevel"] as string)
        : "LOW",
      disposition: (["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"] as const).includes(
        gen["disposition"] as never,
      )
        ? (gen["disposition"] as string)
        : "HOME_CARE",
      suggestedCodes: codes.slice(0, 8),
    };
  });

/** Doctor-reviewed sign-off: writes the visit, diagnoses, prescriptions and observations. */
export const signOffConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        visitId: z.string().uuid(),
        transcript: z.string().max(40000).default(""),
        conclusion: z.string().trim().min(1, "Conclusion is required").max(6000),
        recommendation: z.string().trim().min(1, "Recommendation is required").max(6000),

        urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH_RED_FLAG"]),
        disposition: z.enum(["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"]),
        diagnoses: z
          .array(
            z.object({
              description: z.string().min(1).max(600),
              code: z.string().max(24).nullable().optional(),
              status: z.enum(["ACTIVE", "RESOLVED", "SUSPECTED"]).default("ACTIVE"),
            }),
          )
          .max(30)
          .default([]),
        prescriptions: z
          .array(
            z.object({
              drugName: z.string().min(1).max(160),
              atcCode: z.string().max(16).nullable().optional(),
              dosage: z.string().max(120).nullable().optional(),
              frequency: z.string().max(120).nullable().optional(),
            }),
          )
          .max(30)
          .default([]),
        observations: z
          .array(
            z.object({
              testName: z.string().min(1).max(160),
              loincCode: z.string().max(24).nullable().optional(),
              value: z.number().nullable().optional(),
              unit: z.string().max(32).nullable().optional(),
              status: z.enum(["ORDERED", "PENDING", "RESULTED", "CANCELLED"]).optional(),
            }),
          )
          .max(30)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: visit }] = await Promise.all([
      supabase.from("profiles").select("practitioner_id").eq("id", userId).maybeSingle(),
      supabase
        .from("visit")
        .select("id, patient_id, practitioner_id, visit_transcript")
        .eq("id", data.visitId)
        .maybeSingle(),
    ]);

    if (!visit) throw new Error("Visit not found");
    if (!profile?.practitioner_id || visit.practitioner_id !== profile.practitioner_id) {
      throw new Error("Only the clinician running this visit can sign it off");
    }

    // Require at least one clinical record: either new diagnoses or already documented.
    if (!data.diagnoses.length) {
      const { count, error: recordError } = await supabase
        .from("clinical_record")
        .select("id", { count: "exact", head: true })
        .eq("visit_id", data.visitId);
      if (recordError) throw new Error(recordError.message);
      if (!count) {
        throw new Error("Add at least one clinical record before signing off this consultation");
      }
    }


    const transcript = data.transcript
      ? [visit.visit_transcript, data.transcript].filter(Boolean).join("\n\n")
      : visit.visit_transcript;

    const { error: visitError } = await supabase
      .from("visit")
      .update({
        conclusion: data.conclusion,
        recommendation: data.recommendation,
        urgency_level: data.urgencyLevel,
        disposition: data.disposition,
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        visit_transcript: transcript,
      })
      .eq("id", data.visitId);
    if (visitError) throw new Error(visitError.message);

    for (const d of data.diagnoses) {
      const { data: record, error } = await supabase
        .from("clinical_record")
        .insert({
          patient_id: visit.patient_id,
          visit_id: data.visitId,
          category: "CONDITION",
          code_system: "ICD10",
          code: d.code || null,
          description: d.description,
          status: d.status,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (record) {
        await supabase.from("visit_clinical_record").insert({
          visit_id: data.visitId,
          clinical_record_id: record.id,
          role_in_visit: "DIAGNOSED",
        });
      }
    }

    if (data.prescriptions.length) {
      const { error } = await supabase.from("drug_prescription").insert(
        data.prescriptions.map((p) => ({
          patient_id: visit.patient_id,
          visit_id: data.visitId,
          drug_name: p.drugName,
          atc_code: p.atcCode || null,
          dosage: p.dosage || null,
          frequency: p.frequency || null,
          start_date: new Date().toISOString().slice(0, 10),
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (data.observations.length) {
      const { error } = await supabase.from("observation").insert(
        data.observations.map((o) => ({
          patient_id: visit.patient_id,
          visit_id: data.visitId,
          test_name: o.testName,
          loinc_code: o.loincCode || null,
          value: o.value ?? null,
          unit: o.unit || null,
          status: o.status ?? "RESULTED",
          ordered_date:
            (o.status ?? "RESULTED") === "RESULTED" ? null : new Date().toISOString().slice(0, 10),
          source: "Ambient consultation",
        })),
      );
      if (error) throw new Error(error.message);
    }

    // The patient-facing after-visit summary and the de-identified population row are generated
    // separately (background calls from the client) so sign-off returns immediately.
    return { ok: true, patientSummary: null as string | null };
  });

/**
 * Writes the de-identified population row (`anonymized_encounter`) for a signed-off visit.
 * Fire-and-forget from the client after sign-off; never blocks the clinician.
 */
export const recordAnonymizedVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { recordAnonymizedEncounter } = await import("@/lib/anonymized-encounter.server");
    return recordAnonymizedEncounter(context.supabase, data.visitId);
  });

/**
 * Runs the follow-up planner agent for a signed-off visit and creates the
 * prefilled SCHEDULED intakes it proposes. Fire-and-forget from the client.
 */
export const planVisitFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { planFollowUpVisits } = await import("@/lib/followup.server");
    return planFollowUpVisits(context.supabase, data.visitId);
  });



/** Patient-facing after-visit summary; returns the stored one unless regeneration is asked for. */
export const generatePatientHandout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ visitId: z.string().uuid(), regenerate: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (!data.regenerate) {
      const { data: existing } = await supabase
        .from("visit")
        .select("patient_summary")
        .eq("id", data.visitId)
        .maybeSingle();
      if (existing?.patient_summary) return { text: existing.patient_summary };
    }

    const { buildPatientHandout } = await import("@/lib/handout.server");
    const text = await buildPatientHandout(supabase, data.visitId);
    if (text) {
      await supabase.from("visit").update({ patient_summary: text }).eq("id", data.visitId);
    }

    return { text: text || "Could not generate a patient summary for this visit." };
  });
