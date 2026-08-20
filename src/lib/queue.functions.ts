import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Persists the clinician's manual queue order (drag & drop, pinning). */
export const saveQueueOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        items: z
          .array(
            z.object({
              visitId: z.string().uuid(),
              position: z.number().int().min(0).max(500),
              pinned: z.boolean(),
            }),
          )
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.practitioner_id) throw new Error("Not a practitioner account");

    if (data.items.length === 0) return { ok: true };

    const { error } = await supabase.from("queue_priority").upsert(
      data.items.map((item) => ({
        practitioner_id: profile.practitioner_id!,
        visit_id: item.visitId,
        position: item.position,
        pinned: item.pinned,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "practitioner_id,visit_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Asks the triage agent to reorder every unpinned patient in the queue. */
export const prioritizeQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.practitioner_id) throw new Error("Not a practitioner account");

    const [{ data: visits }, { data: existing }] = await Promise.all([
      supabase
        .from("visit")
        .select("id, symptoms, urgency_level, encounter_type, status, visit_date, arrived_at, patient:patient(full_name)")
        .eq("practitioner_id", profile.practitioner_id)
        .neq("status", "COMPLETED"),
      supabase
        .from("queue_priority")
        .select("visit_id, position, pinned")
        .eq("practitioner_id", profile.practitioner_id),
    ]);

    const rows = visits ?? [];
    if (rows.length === 0) return { ok: true, source: "heuristic" as const, ordered: 0 };

    const pinned = new Map(
      (existing ?? []).filter((e) => e.pinned).map((e) => [e.visit_id, e.position]),
    );

    const now = Date.now();
    const candidates = rows
      .filter((v) => !pinned.has(v.id))
      .map((v) => ({
        visitId: v.id,
        patientName:
          (v.patient as { full_name?: string } | null)?.full_name ?? "Unknown patient",
        urgency: v.urgency_level ?? "LOW",
        encounterType: v.encounter_type ?? "NEW_ISSUE",
        status: v.status ?? "SCHEDULED",
        symptoms: (v.symptoms ?? "").replace(/\*\*/g, "").slice(0, 400),
        waitedMinutes: Math.max(
          0,
          Math.round((now - new Date(v.arrived_at ?? v.visit_date).getTime()) / 60000),
        ),
      }));

    const { rankQueue } = await import("@/lib/queue-triage.server");
    const { order, reasons, source } = await rankQueue(candidates);

    // Pinned rows keep their slot; the ranked ones fill everything else.
    const total = rows.length;
    const takenSlots = new Set(pinned.values());
    const freeSlots: number[] = [];
    for (let i = 0; i < total; i += 1) if (!takenSlots.has(i)) freeSlots.push(i);

    const updates = [
      ...[...pinned.entries()].map(([visitId, position]) => ({
        practitioner_id: profile.practitioner_id!,
        visit_id: visitId,
        position,
        pinned: true,
        rationale: "Pinned by clinician",
        updated_at: new Date().toISOString(),
      })),
      ...order.map((visitId, index) => ({
        practitioner_id: profile.practitioner_id!,
        visit_id: visitId,
        position: freeSlots[index] ?? total + index,
        pinned: false,
        rationale: reasons[visitId] ?? null,
        updated_at: new Date().toISOString(),
      })),
    ];

    const { error } = await supabase
      .from("queue_priority")
      .upsert(updates, { onConflict: "practitioner_id,visit_id" });
    if (error) throw new Error(error.message);

    return { ok: true, source, ordered: order.length };
  });

/**
 * Patient-facing live queue status for an ongoing (checked-in) visit.
 * Returns aggregate queue stats only — never other patients' identities.
 */
export const getMyQueueStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.patient_id) return null;

    const { data: myVisit } = await supabase
      .from("visit")
      .select("id, practitioner_id, arrived_at, visit_date, urgency_level, practitioner:practitioner(full_name, title, specialization)")
      .eq("patient_id", profile.patient_id)
      .eq("status", "IN_PROGRESS")
      .order("arrived_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!myVisit?.practitioner_id) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: queueVisits }, { data: priorities }] = await Promise.all([
      supabaseAdmin
        .from("visit")
        .select("id, symptoms, urgency_level, encounter_type, arrived_at, visit_date, taken_in_at")
        .eq("practitioner_id", myVisit.practitioner_id)
        .eq("status", "IN_PROGRESS"),
      supabaseAdmin
        .from("queue_priority")
        .select("visit_id, position")
        .eq("practitioner_id", myVisit.practitioner_id),
    ]);

    const rows = queueVisits ?? [];
    if (rows.length === 0) return null;

    const positions = new Map((priorities ?? []).map((p) => [p.visit_id, p.position]));
    const ordered = [...rows].sort((a, b) => {
      const pa = positions.get(a.id) ?? 999;
      const pb = positions.get(b.id) ?? 999;
      if (pa !== pb) return pa - pb;
      return (
        new Date(a.arrived_at ?? a.visit_date).getTime() -
        new Date(b.arrived_at ?? b.visit_date).getTime()
      );
    });

    const myIndex = ordered.findIndex((v) => v.id === myVisit.id);
    const ahead = myIndex > 0 ? ordered.slice(0, myIndex) : [];

    const { estimateDurations, bucketLabel } = await import("@/lib/queue-estimate.server");
    const { durations, source } = await estimateDurations(
      ordered.map((v) => ({
        id: v.id,
        symptoms: (v.symptoms ?? "").replace(/\*\*/g, "").slice(0, 400),
        urgency: v.urgency_level ?? "LOW",
        encounterType: v.encounter_type ?? "NEW_ISSUE",
      })),
    );

    const waitMinutes = ahead.reduce((sum, v) => sum + (durations[v.id] ?? 10), 0);
    const bucket = bucketLabel(waitMinutes);

    const counts = { HIGH_RED_FLAG: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
    for (const v of ordered) counts[v.urgency_level ?? "LOW"] = (counts[v.urgency_level ?? "LOW"] ?? 0) + 1;

    const practitioner = myVisit.practitioner as
      | { full_name?: string; title?: string | null; specialization?: string | null }
      | null;

    return {
      visitId: myVisit.id,
      position: myIndex < 0 ? ordered.length : myIndex + 1,
      totalWaiting: ordered.length,
      peopleAhead: ahead.length,
      counts,
      myUrgency: myVisit.urgency_level ?? "LOW",
      arrivedAt: myVisit.arrived_at ?? myVisit.visit_date,
      practitionerName: practitioner?.full_name ?? null,
      practitionerSpecialization: practitioner?.specialization ?? null,
      waitMinutes: bucket.rounded,
      waitLabel: ahead.length === 0 ? "You're next" : bucket.label,
      waitRange: ahead.length === 0 ? "Please stay nearby" : bucket.range,
      estimateSource: source,
    };
  });
