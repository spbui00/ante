
-- ENUMs
DO $$ BEGIN CREATE TYPE public.sex_enum AS ENUM ('MALE','FEMALE','INTERSEX','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gender_identity_enum AS ENUM ('MAN','WOMAN','NON_BINARY','TRANSGENDER_MAN','TRANSGENDER_WOMAN','OTHER','PREFER_NOT_TO_SAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.marital_status_enum AS ENUM ('SINGLE','MARRIED','PARTNERED','SEPARATED','DIVORCED','WIDOWED','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.employment_status_enum AS ENUM ('EMPLOYED','SELF_EMPLOYED','UNEMPLOYED','STUDENT','RETIRED','UNABLE_TO_WORK','OTHER','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.insurance_type_enum AS ENUM ('PUBLIC_GROUP_1','PUBLIC_GROUP_2','PRIVATE','EU_EHIC','SELF_PAY','UNINSURED','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.care_team_status_enum AS ENUM ('ACTIVE','INACTIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Patient demographics
ALTER TABLE public.patient
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS sex public.sex_enum,
  ADD COLUMN IF NOT EXISTS gender_identity public.gender_identity_enum,
  ADD COLUMN IF NOT EXISTS race_ethnicity text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS marital_status public.marital_status_enum,
  ADD COLUMN IF NOT EXISTS employment_status public.employment_status_enum,
  ADD COLUMN IF NOT EXISTS insurance_type public.insurance_type_enum,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_member_id text;

-- Anonymized encounter demographics (no names)
ALTER TABLE public.anonymized_encounter
  ADD COLUMN IF NOT EXISTS sex public.sex_enum,
  ADD COLUMN IF NOT EXISTS gender_identity public.gender_identity_enum,
  ADD COLUMN IF NOT EXISTS race_ethnicity text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_language text,
  ADD COLUMN IF NOT EXISTS marital_status public.marital_status_enum,
  ADD COLUMN IF NOT EXISTS employment_status public.employment_status_enum,
  ADD COLUMN IF NOT EXISTS insurance_type public.insurance_type_enum;

-- Patient registry / care team
CREATE TABLE IF NOT EXISTS public.patient_care_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES public.practitioner(id) ON DELETE CASCADE,
  specialization text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  status public.care_team_status_enum NOT NULL DEFAULT 'ACTIVE',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, practitioner_id, specialization)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_care_team TO authenticated;
GRANT ALL ON public.patient_care_team TO service_role;

ALTER TABLE public.patient_care_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care team readable" ON public.patient_care_team
  FOR SELECT TO authenticated
  USING (public.can_read_patient(patient_id) OR practitioner_id = public.current_practitioner_id());

CREATE POLICY "care team writable" ON public.patient_care_team
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = public.current_patient_id() OR public.can_read_patient(patient_id));

CREATE POLICY "care team updatable" ON public.patient_care_team
  FOR UPDATE TO authenticated
  USING (patient_id = public.current_patient_id() OR public.can_read_patient(patient_id))
  WITH CHECK (patient_id = public.current_patient_id() OR public.can_read_patient(patient_id));

CREATE POLICY "care team deletable" ON public.patient_care_team
  FOR DELETE TO authenticated
  USING (patient_id = public.current_patient_id());

CREATE INDEX IF NOT EXISTS patient_care_team_patient_idx ON public.patient_care_team(patient_id);
CREATE INDEX IF NOT EXISTS patient_care_team_practitioner_idx ON public.patient_care_team(practitioner_id);
