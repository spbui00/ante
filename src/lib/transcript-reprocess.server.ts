/**
 * Re-runs the scribe over a visit's stored transcript and reconciles the result with
 * whatever is already documented on the visit (clinical records, prescriptions,
 * observations). The agent decides per existing item whether to keep, update or
 * delete it, and which new items to add — so a second pass never silently duplicates.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, "public", any>;

type ExistingRecord = { id: string; description: string; code: string | null; status: string };
type ExistingRx = {
  id: string;
  drug_name: string;
  atc_code: string | null;
  dosage: string | null;
  frequency: string | null;
};
type ExistingObs = {
  id: string;
  test_name: string;
  loinc_code: string | null;
  value: number | null;
  unit: string | null;
  status: string;
};

const RECONCILE_SYSTEM = `You are a medical scribe reconciling a consultation transcript with the clinical items already stored for that visit.
You get the transcript and the current stored items (each with an id).
Respond with STRICT JSON only:
{
  "conclusion": string,
  "recommendation": string,
  "urgencyLevel": "LOW"|"MEDIUM"|"HIGH_RED_FLAG",
  "disposition": "HOME_CARE"|"PRESCRIPTION"|"ER_REFERRAL",
  "records": {"update": [{"id": string, "description": string, "code": string|null, "status": "ACTIVE"|"RESOLVED"|"SUSPECTED"}], "delete": [string], "add": [{"description": string, "code": string|null, "status": "ACTIVE"|"RESOLVED"|"SUSPECTED"}]},
  "prescriptions": {"update": [{"id": string, "drugName": string, "atcCode": string|null, "dosage": string|null, "frequency": string|null}], "delete": [string], "add": [{"drugName": string, "atcCode": string|null, "dosage": string|null, "frequency": string|null}]},
  "observations": {"update": [{"id": string, "testName": string, "loincCode": string|null, "value": number|null, "unit": string|null, "status": "ORDERED"|"PENDING"|"RESULTED"|"CANCELLED"}], "delete": [string], "add": [{"testName": string, "loincCode": string|null, "value": number|null, "unit": string|null, "status": "ORDERED"|"PENDING"|"RESULTED"|"CANCELLED"}]}
}
Rules:
- If an existing item matches something in the transcript but has wrong or outdated details, put it in "update" with the corrected values (do not also add a duplicate).
- If an existing item is NOT supported by the transcript at all, put its id in "delete".
- Only "add" items that are supported by the transcript and are not already stored.
- If an existing item is correct as-is, leave it out entirely (it is kept).
- Never invent findings. Empty arrays are fine.`;

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

function bucket(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    update: asArray<Record<string, unknown>>(o["update"]),
    delete: asArray<unknown>(o["delete"]).filter((x): x is string => typeof x === "string"),
    add: asArray<Record<string, unknown>>(o["add"]),
  };
}

export async function reprocessVisitFromTranscript(supabase: DB, visitId: string) {
  const { cortiChat } = await import("@/lib/corti.server");

  const { data: visit } = await supabase
    .from("visit")
    .select("id, patient_id, visit_transcript, status")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit) throw new Error("Visit not found");
  const transcript = (visit.visit_transcript ?? "").trim();
  if (transcript.length < 40) throw new Error("This visit has no saved transcript to reprocess");

  const [records, prescriptions, observations] = await Promise.all([
    supabase
      .from("clinical_record")
      .select("id, description, code, status")
      .eq("visit_id", visitId),
    supabase
      .from("drug_prescription")
      .select("id, drug_name, atc_code, dosage, frequency")
      .eq("visit_id", visitId),
    supabase
      .from("observation")
      .select("id, test_name, loinc_code, value, unit, status")
      .eq("visit_id", visitId),
  ]);

  const existingRecords = (records.data ?? []) as ExistingRecord[];
  const existingRx = (prescriptions.data ?? []) as ExistingRx[];
  const existingObs = (observations.data ?? []) as ExistingObs[];

  const raw = await cortiChat({
    system: RECONCILE_SYSTEM,
    user: `Consultation transcript:\n${transcript}\n\nStored clinical records:\n${JSON.stringify(existingRecords)}\n\nStored prescriptions:\n${JSON.stringify(existingRx)}\n\nStored observations:\n${JSON.stringify(existingObs)}`,
  });

  let gen: Record<string, unknown> = {};
  try {
    gen = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error("Could not read the reprocessing result");
  }

  const recordPlan = bucket(gen["records"]);
  const rxPlan = bucket(gen["prescriptions"]);
  const obsPlan = bucket(gen["observations"]);

  const validId = (ids: string[], pool: { id: string }[]) =>
    ids.filter((id) => pool.some((p) => p.id === id));

  const counts = { updated: 0, deleted: 0, added: 0 };
  const today = new Date().toISOString().slice(0, 10);

  // ---- clinical records -------------------------------------------------
  for (const u of recordPlan.update) {
    const id = str(u["id"]);
    if (!existingRecords.some((r) => r.id === id)) continue;
    const { error } = await supabase
      .from("clinical_record")
      .update({
        description: str(u["description"]) || undefined,
        code: (u["code"] as string | null) ?? null,
        status: ["ACTIVE", "RESOLVED", "SUSPECTED"].includes(str(u["status"]))
          ? str(u["status"])
          : "ACTIVE",
      })
      .eq("id", id);
    if (!error) counts.updated += 1;
  }
  const recordDeletes = validId(recordPlan.delete, existingRecords);
  if (recordDeletes.length) {
    await supabase.from("visit_clinical_record").delete().in("clinical_record_id", recordDeletes);
    const { error } = await supabase.from("clinical_record").delete().in("id", recordDeletes);
    if (!error) counts.deleted += recordDeletes.length;
  }
  for (const a of recordPlan.add) {
    const description = str(a["description"]);
    if (!description) continue;
    const { data: created, error } = await supabase
      .from("clinical_record")
      .insert({
        patient_id: visit.patient_id,
        visit_id: visitId,
        category: "CONDITION",
        code_system: "ICD10",
        code: (a["code"] as string | null) ?? null,
        description,
        status: ["ACTIVE", "RESOLVED", "SUSPECTED"].includes(str(a["status"]))
          ? str(a["status"])
          : "ACTIVE",
      })
      .select("id")
      .single();
    if (!error && created) {
      counts.added += 1;
      await supabase.from("visit_clinical_record").insert({
        visit_id: visitId,
        clinical_record_id: created.id,
        role_in_visit: "DIAGNOSED",
      });
    }
  }

  // ---- prescriptions ----------------------------------------------------
  for (const u of rxPlan.update) {
    const id = str(u["id"]);
    if (!existingRx.some((r) => r.id === id)) continue;
    const { error } = await supabase
      .from("drug_prescription")
      .update({
        drug_name: str(u["drugName"]) || undefined,
        atc_code: (u["atcCode"] as string | null) ?? null,
        dosage: (u["dosage"] as string | null) ?? null,
        frequency: (u["frequency"] as string | null) ?? null,
      })
      .eq("id", id);
    if (!error) counts.updated += 1;
  }
  const rxDeletes = validId(rxPlan.delete, existingRx);
  if (rxDeletes.length) {
    const { error } = await supabase.from("drug_prescription").delete().in("id", rxDeletes);
    if (!error) counts.deleted += rxDeletes.length;
  }
  const rxAdds = rxPlan.add.filter((a) => str(a["drugName"]));
  if (rxAdds.length) {
    const { error } = await supabase.from("drug_prescription").insert(
      rxAdds.map((a) => ({
        patient_id: visit.patient_id,
        visit_id: visitId,
        drug_name: str(a["drugName"]),
        atc_code: (a["atcCode"] as string | null) ?? null,
        dosage: (a["dosage"] as string | null) ?? null,
        frequency: (a["frequency"] as string | null) ?? null,
        start_date: today,
      })),
    );
    if (!error) counts.added += rxAdds.length;
  }

  // ---- observations -----------------------------------------------------
  const obsStatus = (v: unknown) =>
    ["ORDERED", "PENDING", "RESULTED", "CANCELLED"].includes(str(v)) ? str(v) : "RESULTED";

  for (const u of obsPlan.update) {
    const id = str(u["id"]);
    if (!existingObs.some((o) => o.id === id)) continue;
    const status = obsStatus(u["status"]);
    const { error } = await supabase
      .from("observation")
      .update({
        test_name: str(u["testName"]) || undefined,
        loinc_code: (u["loincCode"] as string | null) ?? null,
        value: typeof u["value"] === "number" ? (u["value"] as number) : null,
        unit: (u["unit"] as string | null) ?? null,
        status,
        ordered_date: status === "RESULTED" ? null : today,
      })
      .eq("id", id);
    if (!error) counts.updated += 1;
  }
  const obsDeletes = validId(obsPlan.delete, existingObs);
  if (obsDeletes.length) {
    const { error } = await supabase.from("observation").delete().in("id", obsDeletes);
    if (!error) counts.deleted += obsDeletes.length;
  }
  const obsAdds = obsPlan.add.filter((a) => str(a["testName"]));
  if (obsAdds.length) {
    const { error } = await supabase.from("observation").insert(
      obsAdds.map((a) => {
        const status = obsStatus(a["status"]);
        return {
          patient_id: visit.patient_id,
          visit_id: visitId,
          test_name: str(a["testName"]),
          loinc_code: (a["loincCode"] as string | null) ?? null,
          value: typeof a["value"] === "number" ? (a["value"] as number) : null,
          unit: (a["unit"] as string | null) ?? null,
          status,
          ordered_date: status === "RESULTED" ? null : today,
          source: "Transcript reprocessing",
        };
      }),
    );
    if (!error) counts.added += obsAdds.length;
  }

  // ---- narrative --------------------------------------------------------
  const conclusion = str(gen["conclusion"]).trim();
  const recommendation = str(gen["recommendation"]).trim();
  const update: Record<string, unknown> = {};
  if (conclusion) update["conclusion"] = conclusion;
  if (recommendation) update["recommendation"] = recommendation;
  if (["LOW", "MEDIUM", "HIGH_RED_FLAG"].includes(str(gen["urgencyLevel"]))) {
    update["urgency_level"] = str(gen["urgencyLevel"]);
  }
  if (["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"].includes(str(gen["disposition"]))) {
    update["disposition"] = str(gen["disposition"]);
  }
  if (Object.keys(update).length) {
    await supabase.from("visit").update(update).eq("id", visitId);
  }

  // Keep the de-identified population record in sync with the reprocessed visit.
  let anonymized: { ok: boolean; embedded: boolean; reason?: string } | null = null;
  if ((visit as any).status === "COMPLETED") {
    try {
      const { recordAnonymizedEncounter } = await import("@/lib/anonymized-encounter.server");
      anonymized = await recordAnonymizedEncounter(supabase, visitId);
    } catch (error) {
      console.error("[transcript-reprocess] anonymized refresh failed", error);
    }
  }

  return { ok: true, ...counts, conclusion, recommendation, anonymized };
}
