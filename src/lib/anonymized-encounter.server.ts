/**
 * De-identified population write (server-only).
 *
 * Called after a consultation is signed off. Builds one `anonymized_encounter`
 * row from the identifiable visit + patient record, plus a Corti embedding of a
 * de-identified clinical summary.
 *
 * De-identification rules (never relax these):
 *   - no names, no CPR numbers, no exact dates of birth (age in years only)
 *   - no free-text transcripts (they contain names, workplaces, relatives)
 *   - postal code is coarsened to the first two digits inside the embedding text
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { ageBracketFromDob, symptomDurationCategory } from "@/lib/clinical-utils";

type AnySupabase = SupabaseClient<any, any, any>;

function ageYears(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(years) && years >= 0 && years < 130 ? years : null;
}

function line(label: string, value: unknown): string | null {
  if (value == null) return null;
  const text = Array.isArray(value) ? value.filter(Boolean).join("; ") : String(value);
  return text.trim() ? `${label}: ${text.trim()}` : null;
}

/**
 * The text we embed. Structured, code-rich and identifier-free — codes give
 * precision for cluster detection, the clinician's own wording adds the nuance
 * the codes miss, and the coarse demographic/temporal context lets clusters
 * group by region and season without identifying anyone.
 */
export function buildEmbeddingText(input: {
  ageYears: number | null;
  sex: string | null;
  isPregnant: boolean;
  encounterType: string | null;
  urgencyLevel: string | null;
  disposition: string | null;
  symptoms: string | null;
  symptomDuration: string | null;
  diagnoses: string[];
  history: string[];
  observations: string[];
  prescriptions: string[];
  conclusion: string | null;
  recommendation: string | null;
  region: string | null;
  industry: string | null;
  period: string | null;
}): string {
  const who = [
    input.ageYears != null ? `${input.ageYears}yo` : "age unknown",
    (input.sex ?? "unknown sex").toLowerCase(),
    input.isPregnant ? "pregnant" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    line("Patient", who),
    line("Encounter", [input.encounterType, input.urgencyLevel, input.disposition].filter(Boolean)),
    line("Symptoms", input.symptoms),
    line("Duration", input.symptomDuration),
    line("Diagnoses", input.diagnoses),
    line("Relevant history", input.history),
    line("Observations", input.observations),
    line("Prescriptions", input.prescriptions),
    line("Conclusion", input.conclusion),
    line("Plan", input.recommendation),
    line("Region", input.region),
    line("Industry", input.industry),
    line("Period", input.period),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Reads the signed-off visit through the caller's client (RLS applies), then
 * writes the de-identified row with the service-role client, because
 * `anonymized_encounter` denies inserts to app roles by policy.
 */
export async function recordAnonymizedEncounter(
  supabase: AnySupabase,
  visitId: string,
): Promise<{ ok: boolean; embedded: boolean; reason?: string }> {
  const { data: visit } = await supabase
    .from("visit")
    .select(
      "id, patient_id, visit_date, completed_at, encounter_type, urgency_level, disposition, symptoms, conclusion, recommendation, symptom_icd_codes, symptom_duration_days, travel_history, is_pregnant",
    )
    .eq("id", visitId)
    .maybeSingle();

  if (!visit) return { ok: false, embedded: false, reason: "visit_not_found" };

  const [{ data: patient }, { data: records }, { data: observations }, { data: prescriptions }] =
    await Promise.all([
      supabase
        .from("patient")
        .select(
          "date_of_birth, sex, gender_identity, race_ethnicity, primary_language, marital_status, employment_status, insurance_type, postal_code, industry, family_medical_history_icd_codes",
        )
        .eq("id", visit.patient_id)
        .maybeSingle(),
      supabase
        .from("clinical_record")
        .select("code, description, category, status, visit_id")
        .eq("patient_id", visit.patient_id),
      supabase
        .from("observation")
        .select("test_name, loinc_code, value, unit, status")
        .eq("visit_id", visitId),
      supabase
        .from("drug_prescription")
        .select("drug_name, atc_code, dosage, frequency")
        .eq("visit_id", visitId),
    ]);

  const when = new Date(visit.completed_at ?? visit.visit_date ?? Date.now());

  const visitRecords = (records ?? []).filter((r: any) => r.visit_id === visitId);
  const historyRecords = (records ?? []).filter((r: any) => r.visit_id !== visitId);

  const diagnosisCodes = visitRecords
    .map((r: any) => r.code)
    .filter((c: unknown): c is string => Boolean(c));
  const historyCodes = historyRecords
    .map((r: any) => r.code)
    .filter((c: unknown): c is string => Boolean(c));

  const embeddingText = buildEmbeddingText({
    ageYears: ageYears(patient?.date_of_birth),
    sex: patient?.sex ?? null,
    isPregnant: Boolean(visit.is_pregnant),
    encounterType: visit.encounter_type ?? null,
    urgencyLevel: visit.urgency_level ?? null,
    disposition: visit.disposition ?? null,
    symptoms: visit.symptoms ?? null,
    symptomDuration: symptomDurationCategory(visit.symptom_duration_days),
    diagnoses: visitRecords.map((r: any) =>
      [r.description, r.code ? `(${r.code})` : null, r.status ? `[${r.status}]` : null]
        .filter(Boolean)
        .join(" "),
    ),
    history: historyRecords.map((r: any) =>
      [r.category, r.description, r.code ? `(${r.code})` : null].filter(Boolean).join(" "),
    ),
    observations: (observations ?? []).map((o: any) =>
      [
        o.test_name,
        o.loinc_code ? `(${o.loinc_code})` : null,
        o.value != null ? `${o.value}${o.unit ? ` ${o.unit}` : ""}` : null,
        o.status && o.status !== "RESULTED" ? `[${o.status}]` : null,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    prescriptions: (prescriptions ?? []).map((p: any) =>
      [p.drug_name, p.atc_code ? `(${p.atc_code})` : null, p.dosage, p.frequency]
        .filter(Boolean)
        .join(" "),
    ),
    conclusion: visit.conclusion ?? null,
    recommendation: visit.recommendation ?? null,
    region: patient?.postal_code ? `${String(patient.postal_code).slice(0, 2)}xx` : null,
    industry: patient?.industry ?? null,
    period: `${when.toLocaleString("en-GB", { month: "long" })} ${when.getFullYear()}`,
  });

  let embedding: number[] | null = null;
  try {
    const { embedText } = await import("@/lib/corti.server");
    embedding = await embedText(embeddingText);
  } catch (error) {
    console.error("[anonymized-encounter] embedding failed", error);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.from("anonymized_encounter").insert({
    encounter_date: when.toISOString(),
    year: when.getUTCFullYear(),
    month: when.getUTCMonth() + 1,
    day_of_week: when.toLocaleDateString("en-GB", { weekday: "long" }),
    hour_of_day: when.getUTCHours(),
    postal_code: patient?.postal_code ?? null,
    age_bracket: ageBracketFromDob(patient?.date_of_birth),
    industry: patient?.industry ?? null,
    is_pregnant: Boolean(visit.is_pregnant),
    sex: patient?.sex ?? null,
    gender_identity: patient?.gender_identity ?? null,
    race_ethnicity: patient?.race_ethnicity ?? [],
    primary_language: patient?.primary_language ?? null,
    marital_status: patient?.marital_status ?? null,
    employment_status: patient?.employment_status ?? null,
    insurance_type: patient?.insurance_type ?? null,
    primary_icd_10: diagnosisCodes[0] ?? null,
    secondary_icd_10_codes: diagnosisCodes.slice(1),
    symptom_icd_codes: visit.symptom_icd_codes ?? [],
    clinical_history_icd_codes: [
      ...historyCodes,
      ...(Array.isArray(patient?.family_medical_history_icd_codes)
        ? patient.family_medical_history_icd_codes
        : []),
    ],
    observations_loinc: (observations ?? [])
      .filter((o: any) => o.loinc_code)
      .map((o: any) => ({ code: o.loinc_code, value: o.value ?? null, unit: o.unit ?? null })),
    prescription_atc_codes: (prescriptions ?? [])
      .filter((p: any) => p.atc_code)
      .map((p: any) => p.atc_code),
    encounter_type: visit.encounter_type ?? null,
    symptom_duration_category: symptomDurationCategory(visit.symptom_duration_days),
    travel_history: visit.travel_history ?? [],
    urgency_level: visit.urgency_level ?? null,
    disposition: visit.disposition ?? null,
    clinical_embedding: embedding ? JSON.stringify(embedding) : null,
  });

  if (error) {
    console.error("[anonymized-encounter] insert failed", error.message);
    return { ok: false, embedded: Boolean(embedding), reason: error.message };
  }

  return { ok: true, embedded: Boolean(embedding) };
}
