import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Agent recommendation of which care-team practitioner fits this pre-intake. */
export const recommendCareForVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.patient_id) throw new Error("No patient record linked to this account");

    const { data: visit } = await supabase
      .from("visit")
      .select("id, symptoms, urgency_level, encounter_type, patient_id")
      .eq("id", data.visitId)
      .maybeSingle();
    if (!visit || visit.patient_id !== profile.patient_id) throw new Error("Visit not found");

    const [{ data: careTeam }, { data: records }] = await Promise.all([
      supabase
        .from("patient_care_team")
        .select(
          "specialization, is_primary, practitioner:practitioner(id, full_name, title, role, specialization, license_number)",
        )
        .eq("patient_id", profile.patient_id)
        .eq("status", "ACTIVE"),
      supabase
        .from("clinical_record")
        .select("description, category, status")
        .eq("patient_id", profile.patient_id)
        .eq("category", "CONDITION")
        .limit(10),
    ]);

    type P = {
      id: string;
      full_name: string;
      title: string | null;
      role: string;
      specialization: string | null;
      license_number: string | null;
    };

    const members = (careTeam ?? [])
      .map((row) => {
        const p = row.practitioner as unknown as P | null;
        if (!p) return null;
        return {
          id: p.id,
          name: [p.title, p.full_name].filter(Boolean).join(" "),
          role: p.role,
          specialization: p.specialization ?? row.specialization ?? null,
          licenseNumber: p.license_number ?? null,
          isPrimary: Boolean(row.is_primary),
        };
      })
      .filter(Boolean) as {
      id: string;
      name: string;
      role: string;
      specialization: string | null;
      licenseNumber: string | null;
      isPrimary: boolean;
    }[];

    const { recommendPractitioner } = await import("@/lib/care-navigator.server");
    const result = await recommendPractitioner({
      symptoms: (visit.symptoms ?? "").replace(/\*\*/g, "").slice(0, 800),
      urgency: visit.urgency_level ?? "LOW",
      encounterType: visit.encounter_type ?? "NEW_ISSUE",
      conditions: (records ?? []).map((r) => r.description).slice(0, 10),
      careTeam: members.map(({ id, name, role, specialization }) => ({
        id,
        name,
        role,
        specialization,
      })),
    });

    return {
      ...result,
      urgency: visit.urgency_level ?? "LOW",
      careTeam: members,
    };
  });

/** Patient-facing practitioner lookup by name or license number. */
export const searchPractitioners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const term = data.query.replace(/[%,]/g, " ").trim();

    const { data: rows, error } = await context.supabase
      .from("practitioner")
      .select(
        "id, full_name, title, role, specialization, license_number, organization:organization(name, region)",
      )
      .or(
        `full_name.ilike.%${term}%,license_number.ilike.%${term}%,specialization.ilike.%${term}%`,
      )
      .limit(15);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((p) => ({
      id: p.id,
      name: [p.title, p.full_name].filter(Boolean).join(" "),
      role: p.role,
      specialization: p.specialization,
      licenseNumber: p.license_number,
      organization: (p.organization as { name?: string; region?: string } | null)?.name ?? null,
    }));
  });

/**
 * Aggregate waiting-room status for a practitioner, plus where this patient
 * would likely land in that queue given their intake urgency.
 */
export const getPractitionerWaitingRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ practitionerId: z.string().uuid(), visitId: z.string().uuid().optional() })
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

    let myUrgency = "LOW";
    let mySymptoms = "";
    if (data.visitId) {
      const { data: visit } = await supabase
        .from("visit")
        .select("urgency_level, symptoms, patient_id")
        .eq("id", data.visitId)
        .maybeSingle();
      if (visit && visit.patient_id === profile.patient_id) {
        myUrgency = visit.urgency_level ?? "LOW";
        mySymptoms = (visit.symptoms ?? "").replace(/\*\*/g, "").slice(0, 400);
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: waiting } = await supabaseAdmin
      .from("visit")
      .select("id, symptoms, urgency_level, encounter_type, arrived_at, visit_date")
      .eq("practitioner_id", data.practitionerId)
      .eq("status", "IN_PROGRESS");

    const rows = waiting ?? [];
    const now = Date.now();
    const queue = rows.map((v) => ({
      id: v.id,
      urgency: v.urgency_level ?? "LOW",
      symptoms: (v.symptoms ?? "").replace(/\*\*/g, "").slice(0, 400),
      encounterType: v.encounter_type ?? "NEW_ISSUE",
      waitedMinutes: Math.max(
        0,
        Math.round((now - new Date(v.arrived_at ?? v.visit_date).getTime()) / 60000),
      ),
    }));

    const { predictPosition } = await import("@/lib/care-navigator.server");
    const aheadCount = predictPosition(myUrgency, queue);

    const { estimateDurations, bucketLabel } = await import("@/lib/queue-estimate.server");
    const { durations, source } = await estimateDurations([
      ...queue.map((q) => ({
        id: q.id,
        symptoms: q.symptoms,
        urgency: q.urgency,
        encounterType: q.encounterType,
      })),
      { id: "me", symptoms: mySymptoms, urgency: myUrgency, encounterType: "NEW_ISSUE" },
    ]);

    // Everyone the weighting puts ahead of this patient contributes to the wait.
    const ahead = [...queue]
      .sort((a, b) => b.waitedMinutes - a.waitedMinutes)
      .slice(0, aheadCount);
    const waitMinutes = ahead.reduce((sum, v) => sum + (durations[v.id] ?? 10), 0);
    const bucket = bucketLabel(waitMinutes);

    const counts = { HIGH_RED_FLAG: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
    for (const q of queue) counts[q.urgency] = (counts[q.urgency] ?? 0) + 1;

    return {
      practitionerId: data.practitionerId,
      totalWaiting: queue.length,
      peopleAhead: aheadCount,
      predictedPosition: aheadCount + 1,
      counts,
      myUrgency,
      myConsultationMinutes: durations["me"] ?? 10,
      waitMinutes: bucket.rounded,
      waitLabel: aheadCount === 0 ? "You'd likely be seen first" : bucket.label,
      waitRange: aheadCount === 0 ? "No one ahead of you right now" : bucket.range,
      estimateSource: source,
    };
  });
