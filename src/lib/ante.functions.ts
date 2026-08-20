import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONSENT_DURATIONS } from "@/lib/clinical-utils";

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
        .select("*, practitioner:practitioner(id, full_name, title, specialization)")
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

    if (!profile?.practitioner_id) return { visits: [], consents: [], queue: [] };

    const [visits, consents, queue] = await Promise.all([
      supabase
        .from("visit")
        .select("*, patient:patient(id, full_name, date_of_birth, sex, postal_code, cpr_number)")
        .eq("practitioner_id", profile.practitioner_id)
        .order("visit_date", { ascending: false })
        .limit(50),
      supabase
        .from("consent_grant")
        .select("*, patient:patient(id, full_name)")
        .eq("practitioner_id", profile.practitioner_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("queue_priority")
        .select("visit_id, position, pinned, rationale")
        .eq("practitioner_id", profile.practitioner_id)
        .order("position", { ascending: true }),
    ]);

    return { visits: visits.data ?? [], consents: consents.data ?? [], queue: queue.data ?? [] };
  });

/** Marks the moment the clinician actually takes the patient in. */
export const markVisitTakenIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("visit")
      .update({ taken_in_at: new Date().toISOString() })
      .eq("id", data.visitId)
      .is("taken_in_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
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
        conclusion: z.string().trim().min(1, "Conclusion is required").max(4000),
        recommendation: z.string().trim().min(1, "Recommendation is required").max(4000),
        symptoms: z.string().trim().max(4000).optional(),
        disposition: z.enum(["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"]),
        urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH_RED_FLAG"]),

      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // A signed-off consultation must carry a documented clinical record.
    const { count, error: recordError } = await context.supabase
      .from("clinical_record")
      .select("id", { count: "exact", head: true })
      .eq("visit_id", data.visitId);
    if (recordError) throw new Error(recordError.message);
    if (!count) {
      throw new Error("Add at least one clinical record before signing off this consultation");
    }

    const { error } = await context.supabase
      .from("visit")
      .update({
        conclusion: data.conclusion,
        recommendation: data.recommendation,
        disposition: data.disposition,
        urgency_level: data.urgencyLevel,
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.visitId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Emergency "break glass" access by CPR, always logged with a justification. */
export const forceRequestPatientConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cpr: z.string().trim().min(6).max(15),
        duration: z.enum(["1 hour", "1 day", "1 week", "1 month", "1 year", "3 years"]),
        justification: z.string().trim().min(20).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("break_glass_by_cpr", {
      _cpr: data.cpr,
      _justification: data.justification,
      _duration: CONSENT_DURATIONS[data.duration],
    });
    if (error) throw new Error(error.message);
    return result as {
      ok: boolean;
      reason?: string;
      id?: string;
      patient_name?: string;
    };
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
        .select(
          "id, full_name, first_name, last_name, preferred_name, phone_number, date_of_birth, sex, gender_identity, race_ethnicity, marital_status, employment_status, insurance_type, insurance_provider, insurance_member_id, postal_code, industry, primary_language",
        )
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
        postalCode: z.string().max(10).optional().nullable(),
        primaryLanguage: z.string().max(10).optional().nullable(),
        firstName: z.string().max(60).optional().nullable(),
        lastName: z.string().max(60).optional().nullable(),
        practitionerRole: z.enum(["DOCTOR", "NURSE"]).optional(),
        specialization: z.string().max(80).optional().nullable(),
        licenseNumber: z.string().max(32).optional().nullable(),
        phoneNumber: z.string().max(30).optional().nullable(),
        preferredName: z.string().max(80).optional().nullable(),
        sex: z.enum(["MALE", "FEMALE", "INTERSEX", "UNKNOWN"]).optional().nullable(),
        genderIdentity: z
          .enum([
            "MAN",
            "WOMAN",
            "NON_BINARY",
            "TRANSGENDER_MAN",
            "TRANSGENDER_WOMAN",
            "OTHER",
            "PREFER_NOT_TO_SAY",
          ])
          .optional()
          .nullable(),
        raceEthnicity: z.array(z.string().max(60)).max(12).optional(),
        maritalStatus: z
          .enum(["SINGLE", "MARRIED", "PARTNERED", "SEPARATED", "DIVORCED", "WIDOWED", "UNKNOWN"])
          .optional()
          .nullable(),
        employmentStatus: z
          .enum([
            "EMPLOYED",
            "SELF_EMPLOYED",
            "UNEMPLOYED",
            "STUDENT",
            "RETIRED",
            "UNABLE_TO_WORK",
            "OTHER",
            "UNKNOWN",
          ])
          .optional()
          .nullable(),
        insuranceType: z
          .enum(["PUBLIC_GROUP_1", "PUBLIC_GROUP_2", "PRIVATE", "EU_EHIC", "SELF_PAY", "UNINSURED", "UNKNOWN"])
          .optional()
          .nullable(),
        insuranceProvider: z.string().max(80).optional().nullable(),
        insuranceMemberId: z.string().max(60).optional().nullable(),
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
          first_name: data.firstName || null,
          last_name: data.lastName || null,
          phone_number: data.phoneNumber || null,
          date_of_birth: data.dateOfBirth || null,
          postal_code: data.postalCode || null,
          primary_language: data.primaryLanguage || "da",
          preferred_name: data.preferredName || null,
          sex: data.sex || null,
          gender_identity: data.genderIdentity || null,
          race_ethnicity: data.raceEthnicity ?? [],
          marital_status: data.maritalStatus || null,
          employment_status: data.employmentStatus || null,
          insurance_type: data.insuranceType || null,
          insurance_provider: data.insuranceProvider || null,
          insurance_member_id: data.insuranceMemberId || null,
        })
        .eq("id", profile.patient_id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

/** Care team registry: practitioners linked to the signed-in patient by specialization. */
export const getMyCareTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.patient_id) return { careTeam: [], practitioners: [], consents: [] };

    const { data: careTeam, error } = await supabase
      .from("patient_care_team")
      .select(
        "id, specialization, is_primary, status, assigned_at, practitioner:practitioner(id, full_name, title, role, specialization, license_number, organization:organization(name, region, type))",
      )
      .eq("patient_id", profile.patient_id)
      .order("is_primary", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: practitioners } = await supabase
      .from("practitioner")
      .select("id, full_name, title, role, specialization")
      .order("full_name");

    const { data: consents } = await supabase
      .from("consent_grant")
      .select("id, practitioner_id, status, granted_at, expires_at, created_at, is_emergency_override")
      .eq("patient_id", profile.patient_id)
      .order("created_at", { ascending: false });

    return { careTeam: careTeam ?? [], practitioners: practitioners ?? [], consents: consents ?? [] };
  });


export const addCareTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        practitionerId: z.string().uuid(),
        specialization: z.string().min(1).max(80),
        isPrimary: z.boolean().optional(),
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

    const { error } = await supabase.from("patient_care_team").insert({
      patient_id: profile.patient_id,
      practitioner_id: data.practitionerId,
      specialization: data.specialization,
      is_primary: data.isPrimary ?? false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCareTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.patient_id) throw new Error("No patient record linked to this account");

    // Look up the member first so we know which practitioner's consent to revoke.
    const { data: member } = await supabase
      .from("patient_care_team")
      .select("id, practitioner_id")
      .eq("id", data.id)
      .eq("patient_id", profile.patient_id)
      .maybeSingle();
    if (!member) throw new Error("Care team member not found");

    const { error: consentError } = await supabase
      .from("consent_grant")
      .update({ status: "REVOKED" })
      .eq("patient_id", profile.patient_id)
      .eq("practitioner_id", member.practitioner_id)
      .in("status", ["ACTIVE", "PENDING"]);
    if (consentError) throw new Error(consentError.message);

    const { error } = await supabase.from("patient_care_team").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Full visit history for the signed-in patient, plus the doctors seen. */
export const getMyVisitHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.patient_id) return { visits: [] };

    const { data, error } = await supabase
      .from("visit")
      .select(
        "id, visit_date, encounter_type, urgency_level, status, disposition, conclusion, recommendation, symptoms, symptom_icd_codes, intake_transcript, travel_history, symptom_duration_days, practitioner_id, practitioner:practitioner(id, full_name, title, specialization)",
      )
      .eq("patient_id", profile.patient_id)
      .order("visit_date", { ascending: false });
    if (error) throw new Error(error.message);

    return { visits: data ?? [] };
  });

/** Practitioner requests record access for a patient identified by CPR. */
export const requestPatientConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cpr: z.string().trim().min(6).max(15),
        duration: z.enum(["1 hour", "1 day", "1 week", "1 month", "1 year", "3 years"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("request_consent_by_cpr", {
      _cpr: data.cpr,
      _duration: CONSENT_DURATIONS[data.duration],
    });
    if (error) throw new Error(error.message);
    return result as {
      ok: boolean;
      reason?: string;
      id?: string;
      patient_name?: string;
    };
  });

/** Consent requests addressed to the signed-in patient. */
export const getMyConsentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("patient_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.patient_id) return { requests: [] };

    const { data, error } = await supabase
      .from("consent_grant")
      .select(
        "id, status, expires_at, granted_at, created_at, is_emergency_override, justification_notes, practitioner:practitioner(id, full_name, title, role, specialization, organization:organization(name))",
      )
      .eq("patient_id", profile.patient_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return { requests: data ?? [] };
  });

/** Patient accepts or declines a consent request (after mock biometric check). */
export const respondToConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ consentId: z.string().uuid(), accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: updated, error } = await supabase
      .from("consent_grant")
      .update(
        data.accept
          ? { status: "ACTIVE" as const, granted_at: new Date().toISOString() }
          : { status: "REVOKED" as const },
      )
      .eq("id", data.consentId)
      .select("patient_id, practitioner_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Granting access also adds the practitioner to the patient's care team.
    if (data.accept && updated) {
      const { data: existing } = await supabase
        .from("patient_care_team")
        .select("id")
        .eq("patient_id", updated.patient_id)
        .eq("practitioner_id", updated.practitioner_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("patient_care_team")
          .update({ status: "ACTIVE" as const, ended_at: null })
          .eq("id", existing.id);
      } else {
        const { data: prac } = await supabase
          .from("practitioner")
          .select("specialization, role")
          .eq("id", updated.practitioner_id)
          .maybeSingle();

        await supabase.from("patient_care_team").insert({
          patient_id: updated.patient_id,
          practitioner_id: updated.practitioner_id,
          specialization: prac?.specialization || "General practice",
          is_primary: false,
        });
      }
    }

    return { ok: true };
  });


/** Patient registry: everyone who has granted the signed-in practitioner access. */
export const getMyPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.practitioner_id) return { grants: [] };

    const { data, error } = await supabase
      .from("consent_grant")
      .select(
        "id, status, granted_at, expires_at, created_at, is_emergency_override, patient:patient(id, full_name, cpr_number, date_of_birth, sex, postal_code, phone_number, primary_language)",
      )
      .eq("practitioner_id", profile.practitioner_id)
      .in("status", ["PENDING", "ACTIVE"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Drop rows whose patient is no longer readable (revoked/expired access).
    const grants = (data ?? []).filter((g) => g.patient != null);

    return { grants };
  });


/** Practitioner removes a patient from their registry: revokes consent + leaves the care team. */
export const removePatientFromRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ patientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.practitioner_id) throw new Error("No practitioner record linked to this account");

    // Block removal while a visit with this patient is still open in the queue.
    const { data: openVisits, error: openError } = await supabase
      .from("visit")
      .select("id")
      .eq("patient_id", data.patientId)
      .eq("practitioner_id", profile.practitioner_id)
      .in("status", ["SCHEDULED", "IN_PROGRESS"])
      .limit(1);
    if (openError) throw new Error(openError.message);
    if (openVisits && openVisits.length > 0) {
      throw new Error(
        "This patient still has an open visit with you. Complete or cancel the visit before removing them from your registry.",
      );
    }

    // Leave the care team first, while the grant still allows access.
    const { error: teamError } = await supabase
      .from("patient_care_team")
      .delete()
      .eq("patient_id", data.patientId)
      .eq("practitioner_id", profile.practitioner_id);
    if (teamError) throw new Error(teamError.message);

    const { error: consentError } = await supabase
      .from("consent_grant")
      .update({ status: "REVOKED" as const })
      .eq("patient_id", data.patientId)
      .eq("practitioner_id", profile.practitioner_id)
      .in("status", ["ACTIVE", "PENDING"]);
    if (consentError) throw new Error(consentError.message);

    return { ok: true };
  });


/** Full record view for one patient the practitioner has access to. */
export const getPatientRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ patientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [profile, patient, records, prescriptions, observations, visits] = await Promise.all([
      supabase.from("profiles").select("practitioner_id").eq("id", userId).maybeSingle(),
      supabase.from("patient").select("*").eq("id", data.patientId).maybeSingle(),
      supabase
        .from("clinical_record")
        .select("*")
        .eq("patient_id", data.patientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("drug_prescription")
        .select("*")
        .eq("patient_id", data.patientId)
        .order("start_date", { ascending: false }),
      supabase
        .from("observation")
        .select("*")
        .eq("patient_id", data.patientId)
        .order("recorded_at", { ascending: false })
        .limit(20),
      supabase
        .from("visit")
        .select(
          "id, visit_date, encounter_type, urgency_level, status, disposition, symptoms, conclusion, recommendation, practitioner_id, practitioner:practitioner(full_name, title, specialization)",
        )
        .eq("patient_id", data.patientId)
        .order("visit_date", { ascending: false })
        .limit(50),
    ]);

    return {
      viewerPractitionerId: profile.data?.practitioner_id ?? null,
      patient: patient.data,
      records: records.data ?? [],
      prescriptions: prescriptions.data ?? [],
      observations: observations.data ?? [],
      visits: visits.data ?? [],
    };
  });

/** Scheduled (pre-intake) visits for a consented patient, looked up by CPR. */
export const findScheduledVisitsByCpr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ cpr: z.string().trim().min(6).max(15) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const needle = data.cpr.replace(/\D/g, "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.practitioner_id)
      return { ok: false as const, reason: "not_practitioner" as const };

    const { data: patients } = await supabase
      .from("patient")
      .select("id, full_name, cpr_number, date_of_birth")
      .not("cpr_number", "is", null)
      .limit(500);

    const patient = (patients ?? []).find(
      (p) => (p.cpr_number ?? "").replace(/\D/g, "") === needle,
    );
    if (!patient) return { ok: false as const, reason: "not_found" as const };

    const { data: visits, error } = await supabase
      .from("visit")
      .select("id, visit_date, encounter_type, urgency_level, status, symptoms, conclusion")
      .eq("patient_id", patient.id)
      .eq("status", "SCHEDULED")
      .order("visit_date", { ascending: false });
    if (error) throw new Error(error.message);

    return { ok: true as const, patient, visits: visits ?? [] };
  });

/** Patient has physically arrived: attach the visit to this practitioner's queue. */
export const registerVisitArrival = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("practitioner_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.practitioner_id) throw new Error("Not a practitioner account");

    const { error } = await supabase
      .from("visit")
      .update({
        practitioner_id: profile.practitioner_id,
        visit_date: new Date().toISOString(),
        status: "IN_PROGRESS",
        arrived_at: new Date().toISOString(),
      })
      .eq("id", data.visitId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
