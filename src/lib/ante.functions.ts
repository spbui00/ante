import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Identity + role of the signed-in account. */
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await supabase.rpc("claim_demo_identity");

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, patient_id, practitioner_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    let practitioner = null;
    if (profile?.practitioner_id) {
      const { data } = await supabase
        .from("practitioner")
        .select("id, full_name, role, license_number, organization:organization(name, region, type)")
        .eq("id", profile.practitioner_id)
        .maybeSingle();
      practitioner = data;
    }

    return {
      profile: profile ?? null,
      role: (roles?.[0]?.role ?? "PATIENT") as "PATIENT" | "PRACTITIONER" | "ANALYST",
      practitioner,
    };
  });

/** Everything the patient passport renders. */
export const getPassport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await supabase.rpc("claim_demo_identity");

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();

    const patientId = profile?.patient_id;
    if (!patientId) {
      return { patient: null, records: [], prescriptions: [], observations: [], visits: [] };
    }

    const [patient, records, prescriptions, observations, visits] = await Promise.all([
      supabase.from("patient").select("*").eq("id", patientId).maybeSingle(),
      supabase
        .from("clinical_record")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("drug_prescription")
        .select("*")
        .eq("patient_id", patientId)
        .order("start_date", { ascending: false }),
      supabase
        .from("observation")
        .select("*")
        .eq("patient_id", patientId)
        .order("recorded_at", { ascending: false })
        .limit(25),
      supabase
        .from("visit")
        .select("*, practitioner:practitioner(full_name)")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false })
        .limit(25),
    ]);

    return {
      patient: patient.data,
      records: records.data ?? [],
      prescriptions: prescriptions.data ?? [],
      observations: observations.data ?? [],
      visits: visits.data ?? [],
    };
  });

/** Practitioner queue: consented patients and their open visits. */
export const getClinicalQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await supabase.rpc("claim_demo_identity");

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.practitioner_id) return { visits: [], consents: [] };

    const [visits, consents] = await Promise.all([
      supabase
        .from("visit")
        .select("*, patient:patient(id, full_name, date_of_birth, gender, postal_code, cpr_number)")
        .order("visit_date", { ascending: false })
        .limit(50),
      supabase
        .from("consent_grant")
        .select("*, patient:patient(id, full_name)")
        .eq("practitioner_id", profile.practitioner_id)
        .order("created_at", { ascending: false }),
    ]);

    return { visits: visits.data ?? [], consents: consents.data ?? [] };
  });

/** Full consultation view for one visit. */
export const getVisitDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: visit } = await supabase
      .from("visit")
      .select(
        "*, patient:patient(*), practitioner:practitioner(full_name, role, organization:organization(name))",
      )
      .eq("id", data.visitId)
      .maybeSingle();

    if (!visit) return { visit: null, records: [], observations: [], prescriptions: [] };

    const [records, observations, prescriptions] = await Promise.all([
      supabase.from("clinical_record").select("*").eq("patient_id", visit.patient_id),
      supabase.from("observation").select("*").eq("visit_id", data.visitId),
      supabase.from("drug_prescription").select("*").eq("patient_id", visit.patient_id),
    ]);

    return {
      visit,
      records: records.data ?? [],
      observations: observations.data ?? [],
      prescriptions: prescriptions.data ?? [],
    };
  });

/** Practitioner signs off an AI-drafted visit. */
export const finaliseVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        visitId: z.string().uuid(),
        conclusion: z.string().max(4000),
        recommendation: z.string().max(4000),
        disposition: z.enum(["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"]),
        urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH_RED_FLAG"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("visit")
      .update({
        conclusion: data.conclusion,
        recommendation: data.recommendation,
        disposition: data.disposition,
        urgency_level: data.urgencyLevel,
        status: "COMPLETED",
      })
      .eq("id", data.visitId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Emergency "break glass" access, always logged with a justification. */
export const breakGlass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        patientId: z.string().uuid(),
        justification: z.string().min(20).max(1000),
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

    const { error } = await supabase.from("consent_grant").insert({
      patient_id: data.patientId,
      practitioner_id: profile.practitioner_id,
      status: "ACTIVE",
      is_emergency_override: true,
      justification_notes: data.justification,
      granted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Anonymised surveillance feed for analysts. */
export const getSurveillance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        days: z.number().int().min(1).max(365).default(90),
        postalCode: z.string().max(10).optional(),
        ageBracket: z.string().max(10).optional(),
        chapter: z.string().max(6).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAnalyst } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "ANALYST",
    });
    if (!isAnalyst) throw new Error("Analyst role required");


    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000).toISOString();

    let query = supabase
      .from("anonymized_encounter")
      .select(
        "id, encounter_date, postal_code, age_bracket, gender, industry, primary_icd_10, symptom_icd_codes, encounter_type, symptom_duration_category, urgency_level, disposition",
      )
      .gte("encounter_date", since)
      .order("encounter_date", { ascending: false })
      .limit(1000);

    if (data.postalCode) query = query.eq("postal_code", data.postalCode);
    if (data.ageBracket) query = query.eq("age_bracket", data.ageBracket);
    if (data.chapter) query = query.like("primary_icd_10", `${data.chapter}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return { rows: rows ?? [], since };
  });

/** Profile + demographics for the account settings page. */
export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, patient_id, practitioner_id")
      .eq("id", userId)
      .maybeSingle();

    let patient = null;
    if (profile?.patient_id) {
      const { data } = await supabase
        .from("patient")
        .select("id, full_name, date_of_birth, gender, postal_code, industry, primary_language")
        .eq("id", profile.patient_id)
        .maybeSingle();
      patient = data;
    }

    let practitioner = null;
    if (profile?.practitioner_id) {
      const { data } = await supabase
        .from("practitioner")
        .select(
          "id, full_name, first_name, last_name, title, specialization, role, license_number, organization:organization(name, region)",
        )
        .eq("id", profile.practitioner_id)
        .maybeSingle();
      practitioner = data;
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    return {
      profile: profile ?? null,
      patient,
      practitioner,
      role: (roles?.[0]?.role ?? "PATIENT") as "PATIENT" | "PRACTITIONER" | "ANALYST",
    };
  });

/** Update the signed-in account's own profile and patient demographics. */
export const updateMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().min(1).max(120),
        dateOfBirth: z.string().max(10).optional().nullable(),
        gender: z.string().max(30).optional().nullable(),
        postalCode: z.string().max(10).optional().nullable(),
        primaryLanguage: z.string().max(10).optional().nullable(),
        firstName: z.string().max(60).optional().nullable(),
        lastName: z.string().max(60).optional().nullable(),
        practitionerRole: z.enum(["DOCTOR", "NURSE"]).optional(),
        specialization: z.string().max(80).optional().nullable(),
        licenseNumber: z.string().max(32).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", userId);
    if (profileError) throw new Error(profileError.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id, practitioner_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.practitioner_id) {
      const { error } = await supabase
        .from("practitioner")
        .update({
          full_name: data.fullName,
          first_name: data.firstName || null,
          last_name: data.lastName || null,
          ...(data.practitionerRole
            ? {
                role: data.practitionerRole,
                title: data.practitionerRole === "NURSE" ? "Sygeplejerske" : "Læge",
              }
            : {}),
          specialization: data.specialization || null,
          license_number: data.licenseNumber || null,
        })
        .eq("id", profile.practitioner_id);
      if (error) throw new Error(error.message);
    }

    if (profile?.patient_id) {
      const { error } = await supabase
        .from("patient")
        .update({
          full_name: data.fullName,
          date_of_birth: data.dateOfBirth || null,
          gender: data.gender || null,
          postal_code: data.postalCode || null,
          primary_language: data.primaryLanguage || "da",
        })
        .eq("id", profile.patient_id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
