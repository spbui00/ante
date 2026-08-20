/**
 * Builds the clinical briefing that is prepended to an agent conversation:
 * conditions, allergies, active medications, recent observations and recent
 * visit history for the signed-in patient.
 */

type SupabaseLike = {
  from: (table: any) => any;
  rpc: (fn: any, ...args: any[]) => any;
};

function line(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" · ");
}

export async function buildPatientContext(supabase: SupabaseLike, userId: string): Promise<string> {
  await supabase.rpc("claim_demo_identity").catch(() => undefined);

  const { data: profile } = await supabase
    .from("profiles")
    .select("patient_id")
    .eq("id", userId)
    .maybeSingle();

  const patientId = profile?.patient_id as string | undefined;
  if (!patientId) return "";

  const [patient, records, prescriptions, observations, visits] = await Promise.all([
    supabase
      .from("patient")
      .select("full_name, date_of_birth, sex, gender, primary_language")
      .eq("id", patientId)
      .maybeSingle(),
    supabase
      .from("clinical_record")
      .select("category, description, code, status, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("drug_prescription")
      .select("drug_name, dosage, frequency, start_date, end_date")
      .eq("patient_id", patientId)
      .order("start_date", { ascending: false })
      .limit(40),
    supabase
      .from("observation")
      .select("test_name, value, unit, recorded_at")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(15),
    supabase
      .from("visit")
      .select("visit_date, encounter_type, symptoms, conclusion, urgency_level")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .limit(5),
  ]);

  const all = (records.data ?? []) as any[];
  const conditions = all.filter((r) => r.category === "CONDITION");
  const allergies = all.filter((r) => r.category === "ALLERGY");
  const meds = ((prescriptions.data ?? []) as any[]).filter(
    (m) => !m.end_date || new Date(m.end_date) >= new Date(),
  );

  const p = patient.data as any;
  const age = p?.date_of_birth
    ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31_557_600_000)
    : null;

  const sections: string[] = [];

  sections.push(
    `PATIENT: ${line([p?.full_name, age ? `${age}y` : null, p?.sex ?? p?.gender, p?.primary_language])}`,
  );

  sections.push(
    `CONDITIONS:\n${
      conditions.length
        ? conditions
            .map((c) => `- ${line([c.description, c.code, c.status])}`)
            .join("\n")
        : "- none recorded"
    }`,
  );

  sections.push(
    `ALLERGIES:\n${
      allergies.length
        ? allergies.map((a) => `- ${line([a.description, a.status])}`).join("\n")
        : "- none recorded"
    }`,
  );

  sections.push(
    `ACTIVE MEDICATIONS:\n${
      meds.length
        ? meds.map((m) => `- ${line([m.drug_name, m.dosage, m.frequency])}`).join("\n")
        : "- none recorded"
    }`,
  );

  sections.push(
    `RECENT OBSERVATIONS:\n${
      (observations.data ?? []).length
        ? (observations.data as any[])
            .map(
              (o) =>
                `- ${line([
                  o.test_name,
                  o.value != null ? `${o.value}${o.unit ? ` ${o.unit}` : ""}` : null,
                  o.recorded_at?.slice(0, 10),
                ])}`,
            )
            .join("\n")
        : "- none recorded"
    }`,
  );

  sections.push(
    `RECENT VISITS:\n${
      (visits.data ?? []).length
        ? (visits.data as any[])
            .map((v) =>
              `- ${line([
                v.visit_date?.slice(0, 10),
                v.encounter_type,
                v.urgency_level,
                v.symptoms,
                v.conclusion,
              ])}`.slice(0, 400),
            )
            .join("\n")
        : "- none recorded"
    }`,
  );

  return `### PATIENT CLINICAL RECORD (background context — do not read aloud)\n${sections.join("\n\n")}`;
}
