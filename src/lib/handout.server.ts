/** Builds (and stores) the plain-language after-visit summary for a visit. */

const HANDOUT_SYSTEM = `You write the after-visit summary that a patient takes home from a Danish primary-care clinic.
Use warm, plain language at a 6th-grade reading level. No jargon, no ICD/ATC/LOINC codes, no diagnosis speculation beyond what the clinician documented.
Return GitHub-flavoured markdown with exactly these sections:
## What we found
## Your medicines
(one bullet per prescribed medicine: name, how much, how often, and what it is for — if none, write "No new medicines were prescribed today.")
## What to do next
## When to seek help
(clear warning signs that mean the patient should contact the clinic or emergency services)
Never invent medicines, doses or findings that are not in the supplied data.`;

type AnyClient = {
  from: (table: string) => any;
};

export async function buildPatientHandout(supabase: AnyClient, visitId: string) {
  const [{ data: visit }, prescriptions, observations, records] = await Promise.all([
    supabase
      .from("visit")
      .select("id, symptoms, conclusion, recommendation, disposition, urgency_level, visit_date")
      .eq("id", visitId)
      .maybeSingle(),
    supabase.from("drug_prescription").select("drug_name, dosage, frequency").eq("visit_id", visitId),
    supabase.from("observation").select("test_name, value, unit").eq("visit_id", visitId),
    supabase.from("clinical_record").select("description, status").eq("visit_id", visitId),
  ]);

  if (!visit) throw new Error("Visit not found");

  const lines = [
    `Reported symptoms: ${visit.symptoms || "not recorded"}`,
    `Clinician conclusion: ${visit.conclusion || "not recorded"}`,
    `Clinician plan: ${visit.recommendation || "not recorded"}`,
    `Disposition: ${visit.disposition ?? "HOME_CARE"}`,
    `Diagnoses: ${((records.data ?? []) as { description: string; status: string | null }[])
      .map((r) => `${r.description} (${r.status ?? "ACTIVE"})`)
      .join("; ") || "none recorded"}`,
    `Measurements: ${((observations.data ?? []) as { test_name: string; value: number | null; unit: string | null }[])
      .map((o) => `${o.test_name}: ${o.value ?? "?"}${o.unit ? ` ${o.unit}` : ""}`)
      .join("; ") || "none recorded"}`,
    `Prescribed medicines: ${((prescriptions.data ?? []) as { drug_name: string; dosage: string | null; frequency: string | null }[])
      .map((p) => [p.drug_name, p.dosage, p.frequency].filter(Boolean).join(" · "))
      .join("; ") || "none"}`,
  ].join("\n");

  const { cortiChat } = await import("@/lib/corti.server");
  const text = await cortiChat({ system: HANDOUT_SYSTEM, user: lines });
  return text || "";
}

/** Generates the summary and stores it on the visit row. Never throws. */
export async function storePatientHandout(supabase: AnyClient, visitId: string) {
  try {
    const text = await buildPatientHandout(supabase, visitId);
    if (!text) return null;
    await supabase.from("visit").update({ patient_summary: text }).eq("id", visitId);
    return text;
  } catch {
    return null;
  }
}
