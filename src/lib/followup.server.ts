/**
 * Follow-up planner — server only.
 *
 * After a consultation is signed off, the `follow-up-planner` agent reads the
 * clinician's conclusion/plan and decides whether the patient needs a return
 * visit, a check-up or a referral. Each one becomes a SCHEDULED visit with a
 * prefilled intake the patient can review and edit from their passport.
 */

import { AGENTS } from "@/lib/agents/registry";
import { sendAgentMessage } from "@/lib/agents/corti-agents.server";

type AnyClient = { from: (table: string) => any };

/** Marker stored on the generated draft so we never plan the same visit twice. */
export const followUpMarker = (sourceVisitId: string) => `[AUTO_FOLLOW_UP:${sourceVisitId}]`;

type PlannedFollowUp = {
  kind: "FOLLOW_UP" | "CHECKUP" | "REFERRAL";
  reason: string;
  symptoms: string;
  urgency: "LOW" | "MEDIUM" | "HIGH_RED_FLAG";
  inDays: number;
  specialization: string | null;
  practitionerId: string | null;
};

function parsePlan(raw: string): PlannedFollowUp[] {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    return [];
  }
  const list = (parsed as { followUps?: unknown })?.followUps;
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      const f = item as Record<string, unknown>;
      const symptoms = typeof f["symptoms"] === "string" ? f["symptoms"].trim() : "";
      if (!symptoms) return null;
      const kind = (["FOLLOW_UP", "CHECKUP", "REFERRAL"] as const).includes(f["kind"] as never)
        ? (f["kind"] as PlannedFollowUp["kind"])
        : "FOLLOW_UP";
      const urgency = (["LOW", "MEDIUM", "HIGH_RED_FLAG"] as const).includes(
        f["urgency"] as never,
      )
        ? (f["urgency"] as PlannedFollowUp["urgency"])
        : "LOW";
      const days = Number(f["inDays"]);
      return {
        kind,
        reason: typeof f["reason"] === "string" ? f["reason"] : "",
        symptoms: symptoms.slice(0, 4000),
        urgency,
        inDays: Number.isFinite(days) ? Math.min(Math.max(Math.round(days), 1), 365) : 14,
        specialization:
          typeof f["specialization"] === "string" && f["specialization"].trim()
            ? f["specialization"].trim()
            : null,
        practitionerId:
          typeof f["practitionerId"] === "string" &&
          /^[0-9a-f-]{36}$/i.test(f["practitionerId"] as string)
            ? (f["practitionerId"] as string)
            : null,
      } satisfies PlannedFollowUp;
    })
    .filter((f): f is PlannedFollowUp => Boolean(f))
    .slice(0, 3);
}

/**
 * Plans follow-up intakes for a signed-off visit and writes them as SCHEDULED
 * drafts. Idempotent per source visit; never throws.
 */
export async function planFollowUpVisits(supabase: AnyClient, visitId: string) {
  const marker = followUpMarker(visitId);

  const { data: visit } = await supabase
    .from("visit")
    .select(
      "id, patient_id, practitioner_id, symptoms, conclusion, recommendation, disposition, urgency_level, visit_transcript",
    )
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return { created: 0, followUps: [] as { id: string; symptoms: string }[] };

  // Already planned for this consultation.
  const { data: existing } = await supabase
    .from("visit")
    .select("id")
    .eq("patient_id", visit.patient_id)
    .like("intake_transcript", `%${marker}%`)
    .limit(1);
  if (existing?.length) return { created: 0, followUps: [] as { id: string; symptoms: string }[] };

  const [records, prescriptions, observations, careTeam] = await Promise.all([
    supabase.from("clinical_record").select("description, code, status").eq("visit_id", visitId),
    supabase.from("drug_prescription").select("drug_name, dosage, frequency").eq("visit_id", visitId),
    supabase.from("observation").select("test_name, value, unit, status").eq("visit_id", visitId),
    supabase
      .from("patient_care_team")
      .select("specialization, practitioner:practitioner(id, full_name, role, specialization)")
      .eq("patient_id", visit.patient_id)
      .eq("status", "ACTIVE"),
  ]);

  const payload = {
    conclusion: visit.conclusion ?? "",
    plan: visit.recommendation ?? "",
    presentingSymptoms: visit.symptoms ?? "",
    disposition: visit.disposition ?? "HOME_CARE",
    diagnoses: (records.data ?? []).map(
      (r: { description: string; code: string | null; status: string | null }) => ({
        description: r.description,
        code: r.code,
        status: r.status,
      }),
    ),
    prescriptions: (prescriptions.data ?? []).map(
      (p: { drug_name: string; dosage: string | null; frequency: string | null }) => ({
        drug: p.drug_name,
        dosage: p.dosage,
        frequency: p.frequency,
      }),
    ),
    orderedTests: (observations.data ?? [])
      .filter((o: { status: string | null }) => o.status === "ORDERED" || o.status === "PENDING")
      .map((o: { test_name: string }) => o.test_name),
    careTeam: (careTeam.data ?? []).map(
      (row: {
        specialization: string | null;
        practitioner: {
          id: string;
          full_name: string;
          role: string;
          specialization: string | null;
        } | null;
      }) => ({
        id: row.practitioner?.id ?? null,
        name: row.practitioner?.full_name ?? null,
        role: row.practitioner?.role ?? null,
        specialization: row.practitioner?.specialization ?? row.specialization ?? null,
      }),
    ),
    transcriptExcerpt: (visit.visit_transcript ?? "").slice(-6000),
  };

  let raw = "";
  try {
    const reply = await sendAgentMessage({
      definition: AGENTS["follow-up-planner"],
      text: JSON.stringify(payload),
    });
    raw = reply.text;
  } catch (error) {
    console.error("[follow-up-planner] agent call failed", error);
    return { created: 0, followUps: [] as { id: string; symptoms: string }[] };
  }

  const plans = parsePlan(raw);
  if (!plans.length) {
    console.warn("[follow-up-planner] no follow-ups parsed", raw.slice(0, 500));
    return { created: 0, followUps: [] as { id: string; symptoms: string }[] };
  }

  const validIds = new Set(
    payload.careTeam
      .map((m: { id: string | null }) => m.id)
      .filter((id: string | null): id is string => Boolean(id)),
  );


  const rows = plans.map((p) => {
    const date = new Date();
    date.setDate(date.getDate() + p.inDays);
    const heading =
      p.kind === "REFERRAL"
        ? `Referral${p.specialization ? ` to ${p.specialization}` : ""}`
        : p.kind === "CHECKUP"
          ? "Check-up"
          : "Follow-up";
    return {
      patient_id: visit.patient_id,
      practitioner_id: p.practitionerId && validIds.has(p.practitionerId) ? p.practitionerId : null,
      visit_date: date.toISOString(),
      status: "SCHEDULED",
      encounter_type: "FOLLOW_UP",
      urgency_level: p.urgency,
      is_ai_generated: true,
      symptoms: p.symptoms,
      intake_transcript: `${marker}\n${heading}: ${p.reason}`,
    };
  });

  const { data: inserted, error } = await supabase
    .from("visit")
    .insert(rows)
    .select("id, symptoms");
  if (error) {
    console.error("[follow-up-planner] insert failed", error);
    return { created: 0, followUps: [] as { id: string; symptoms: string }[] };
  }

  return {
    created: inserted?.length ?? 0,
    followUps: (inserted ?? []) as { id: string; symptoms: string }[],
  };
}
