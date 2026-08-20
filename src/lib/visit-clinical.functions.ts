import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

const nullableString = (max: number) => z.string().max(max).optional().nullable();


/** Observations, prescriptions and clinical records attached to one visit. */
export const getVisitClinicalItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: visit }] = await Promise.all([
      supabase.from("profiles").select("practitioner_id").eq("id", userId).maybeSingle(),
      supabase.from("visit").select("id, patient_id, practitioner_id").eq("id", data.visitId).maybeSingle(),
    ]);

    if (!visit) return { canEdit: false, observations: [], prescriptions: [], records: [] };

    const canEdit = Boolean(
      profile?.practitioner_id && visit.practitioner_id === profile.practitioner_id,
    );

    const [observations, prescriptions, records] = await Promise.all([
      supabase
        .from("observation")
        .select("*")
        .eq("visit_id", data.visitId)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("drug_prescription")
        .select("*")
        .eq("visit_id", data.visitId)
        .order("created_at", { ascending: false }),
      supabase
        .from("clinical_record")
        .select("*")
        .eq("visit_id", data.visitId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      canEdit,
      observations: observations.data ?? [],
      prescriptions: prescriptions.data ?? [],
      records: records.data ?? [],
    };
  });

async function assertOwnership(supabase: Sb, userId: string, visitId: string): Promise<string> {
  const [{ data: profile }, { data: visit }] = await Promise.all([
    supabase.from("profiles").select("practitioner_id").eq("id", userId).maybeSingle(),
    supabase.from("visit").select("patient_id, practitioner_id").eq("id", visitId).maybeSingle(),
  ]);

  if (!visit) throw new Error("Visit not found");
  if (!profile?.practitioner_id || visit.practitioner_id !== profile.practitioner_id) {
    throw new Error("Only the clinician who ran this visit can edit its records");
  }

  return visit.patient_id;
}


export const saveVisitObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        visitId: z.string().uuid(),
        id: z.string().uuid().optional(),
        testName: z.string().min(1).max(160),
        loincCode: nullableString(24),
        value: z.number().nullable().optional(),
        unit: nullableString(32),
        source: nullableString(80),
        recordedAt: z.string().min(4).max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patientId = await assertOwnership(supabase, userId, data.visitId);

    const payload = {
      patient_id: patientId,
      visit_id: data.visitId,
      test_name: data.testName,
      loinc_code: data.loincCode || null,
      value: data.value ?? null,
      unit: data.unit || null,
      source: data.source || "Practitioner entry",
      ...(data.recordedAt ? { recorded_at: new Date(data.recordedAt).toISOString() } : {}),
    };

    const { error } = data.id
      ? await supabase.from("observation").update(payload).eq("id", data.id)
      : await supabase.from("observation").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveVisitPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        visitId: z.string().uuid(),
        id: z.string().uuid().optional(),
        drugName: z.string().min(1).max(160),
        atcCode: nullableString(16),
        dosage: nullableString(120),
        frequency: nullableString(120),
        startDate: nullableString(10),
        endDate: nullableString(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patientId = await assertOwnership(supabase, userId, data.visitId);

    const payload = {
      patient_id: patientId,
      visit_id: data.visitId,
      drug_name: data.drugName,
      atc_code: data.atcCode || null,
      dosage: data.dosage || null,
      frequency: data.frequency || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
    };

    const { error } = data.id
      ? await supabase.from("drug_prescription").update(payload).eq("id", data.id)
      : await supabase.from("drug_prescription").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveVisitRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        visitId: z.string().uuid(),
        id: z.string().uuid().optional(),
        category: z.enum(["CONDITION", "PROCEDURE", "ALLERGY", "REFERRAL"]),
        codeSystem: z.enum(["SKS", "ICD10", "ICPC2", "SNOMED", "LOINC", "ATC"]),
        code: nullableString(24),
        description: z.string().min(1).max(600),
        status: z.enum(["ACTIVE", "RESOLVED", "SUSPECTED"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patientId = await assertOwnership(supabase, userId, data.visitId);

    const payload = {
      patient_id: patientId,
      visit_id: data.visitId,
      category: data.category,
      code_system: data.codeSystem,
      code: data.code || null,
      description: data.description,
      status: data.status,
    };

    const { error } = data.id
      ? await supabase.from("clinical_record").update(payload).eq("id", data.id)
      : await supabase.from("clinical_record").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVisitClinicalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        visitId: z.string().uuid(),
        id: z.string().uuid(),
        kind: z.enum(["observation", "prescription", "record"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnership(supabase, userId, data.visitId);

    const table =
      data.kind === "observation"
        ? "observation"
        : data.kind === "prescription"
          ? "drug_prescription"
          : "clinical_record";

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", data.id)
      .eq("visit_id", data.visitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
