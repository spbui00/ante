CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('PATIENT','PRACTITIONER','ANALYST');
CREATE TYPE public.organization_type_enum AS ENUM ('HOSPITAL','GP_CLINIC','SPECIALIST');
CREATE TYPE public.practitioner_role_enum AS ENUM ('DOCTOR','NURSE','ADMIN');
CREATE TYPE public.proxy_relationship_enum AS ENUM ('PARENT','GUARDIAN','SPOUSE','POA');
CREATE TYPE public.proxy_status_enum AS ENUM ('ACTIVE','REVOKED');
CREATE TYPE public.consent_status_enum AS ENUM ('PENDING','ACTIVE','REVOKED','EXPIRED');
CREATE TYPE public.encounter_type_enum AS ENUM ('NEW_ISSUE','FOLLOW_UP','CHRONIC_FLARE_UP');
CREATE TYPE public.urgency_enum AS ENUM ('LOW','MEDIUM','HIGH_RED_FLAG');
CREATE TYPE public.visit_status_enum AS ENUM ('SCHEDULED','IN_PROGRESS','COMPLETED');
CREATE TYPE public.disposition_enum AS ENUM ('HOME_CARE','PRESCRIPTION','ER_REFERRAL');
CREATE TYPE public.record_category_enum AS ENUM ('CONDITION','PROCEDURE','ALLERGY','REFERRAL');
CREATE TYPE public.code_system_enum AS ENUM ('SKS','ICD10','ICPC2','SNOMED','LOINC','ATC');
CREATE TYPE public.record_status_enum AS ENUM ('ACTIVE','RESOLVED','SUSPECTED');
CREATE TYPE public.role_in_visit_enum AS ENUM ('REASON_FOR_VISIT','DIAGNOSED','FOLLOW_UP');

-- ============ LOOKUPS ============
CREATE TABLE public.industry_lookup (
  industry_name TEXT PRIMARY KEY
);
CREATE TABLE public.icd10_code_lookup (
  code TEXT PRIMARY KEY,
  chapter TEXT NOT NULL,
  description TEXT NOT NULL
);

-- ============ ORGANIZATION / PRACTITIONER ============
CREATE TABLE public.organization (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type public.organization_type_enum NOT NULL DEFAULT 'GP_CLINIC',
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.practitioner (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organization(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role public.practitioner_role_enum NOT NULL DEFAULT 'DOCTOR',
  license_number TEXT UNIQUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============ PATIENT ============
CREATE TABLE public.patient (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cpr_number TEXT UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  industry TEXT REFERENCES public.industry_lookup(industry_name) ON DELETE SET NULL,
  postal_code TEXT,
  primary_language TEXT NOT NULL DEFAULT 'da',
  family_medical_history_icd_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============ PROFILES + ROLES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  patient_id UUID UNIQUE REFERENCES public.patient(id) ON DELETE SET NULL,
  practitioner_id UUID UNIQUE REFERENCES public.practitioner(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT patient_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_practitioner_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT practitioner_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============ CONSENT / PROXY ============
CREATE TABLE public.consent_grant (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES public.practitioner(id) ON DELETE CASCADE,
  status public.consent_status_enum NOT NULL DEFAULT 'PENDING',
  is_emergency_override BOOLEAN NOT NULL DEFAULT FALSE,
  justification_notes TEXT,
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_consent_patient ON public.consent_grant(patient_id);
CREATE INDEX idx_consent_practitioner ON public.consent_grant(practitioner_id);

CREATE OR REPLACE FUNCTION public.has_consent(_patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consent_grant cg
    WHERE cg.patient_id = _patient_id
      AND cg.practitioner_id = public.current_practitioner_id()
      AND cg.status = 'ACTIVE'
      AND (cg.expires_at IS NULL OR cg.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_patient(_patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _patient_id = public.current_patient_id() OR public.has_consent(_patient_id);
$$;

CREATE TABLE public.patient_proxy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  proxy_patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  relationship public.proxy_relationship_enum NOT NULL,
  status public.proxy_status_enum NOT NULL DEFAULT 'ACTIVE',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  UNIQUE (patient_id, proxy_patient_id)
);

-- ============ CLINICAL ============
CREATE TABLE public.clinical_record (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  category public.record_category_enum NOT NULL,
  code TEXT,
  code_system public.code_system_enum NOT NULL DEFAULT 'ICD10',
  description TEXT NOT NULL,
  status public.record_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_clinical_record_patient ON public.clinical_record(patient_id);

CREATE TABLE public.visit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  practitioner_id UUID REFERENCES public.practitioner(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  intake_transcript TEXT,
  symptoms TEXT,
  conclusion TEXT,
  recommendation TEXT,
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  encounter_type public.encounter_type_enum NOT NULL DEFAULT 'NEW_ISSUE',
  urgency_level public.urgency_enum NOT NULL DEFAULT 'LOW',
  status public.visit_status_enum NOT NULL DEFAULT 'SCHEDULED',
  is_pregnant BOOLEAN NOT NULL DEFAULT FALSE,
  symptom_icd_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  symptom_duration_days INT,
  travel_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  disposition public.disposition_enum,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_visit_patient ON public.visit(patient_id);
CREATE INDEX idx_visit_practitioner ON public.visit(practitioner_id);

CREATE TABLE public.visit_clinical_record (
  visit_id UUID NOT NULL REFERENCES public.visit(id) ON DELETE CASCADE,
  clinical_record_id UUID NOT NULL REFERENCES public.clinical_record(id) ON DELETE CASCADE,
  role_in_visit public.role_in_visit_enum NOT NULL DEFAULT 'DIAGNOSED',
  PRIMARY KEY (visit_id, clinical_record_id)
);

CREATE TABLE public.drug_prescription (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visit(id) ON DELETE SET NULL,
  clinical_record_id UUID REFERENCES public.clinical_record(id) ON DELETE SET NULL,
  drug_name TEXT NOT NULL,
  atc_code TEXT,
  dosage TEXT,
  frequency TEXT,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_prescription_patient ON public.drug_prescription(patient_id);

CREATE TABLE public.observation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visit(id) ON DELETE SET NULL,
  loinc_code TEXT,
  test_name TEXT NOT NULL,
  value DOUBLE PRECISION,
  unit TEXT,
  source TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_observation_patient ON public.observation(patient_id);

-- ============ ANONYMIZED ============
CREATE TABLE public.anonymized_encounter (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encounter_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  year INT,
  month INT,
  day_of_week TEXT,
  hour_of_day INT,
  postal_code TEXT,
  age_bracket TEXT,
  gender TEXT,
  industry TEXT,
  is_pregnant BOOLEAN NOT NULL DEFAULT FALSE,
  weather_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_icd_10 TEXT,
  secondary_icd_10_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  symptom_icd_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinical_history_icd_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations_loinc JSONB NOT NULL DEFAULT '{}'::jsonb,
  prescription_atc_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  encounter_type public.encounter_type_enum,
  symptom_duration_category TEXT,
  travel_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  urgency_level public.urgency_enum,
  disposition public.disposition_enum,
  clinical_embedding vector(1536)
);
CREATE INDEX idx_anon_date ON public.anonymized_encounter(encounter_date);
CREATE INDEX idx_anon_postal ON public.anonymized_encounter(postal_code);

-- ============ GRANTS ============
GRANT SELECT ON public.industry_lookup TO authenticated;
GRANT SELECT ON public.icd10_code_lookup TO authenticated;
GRANT SELECT ON public.organization TO authenticated;
GRANT SELECT ON public.practitioner TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.patient TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_grant TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_proxy TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_record TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_clinical_record TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drug_prescription TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observation TO authenticated;
GRANT SELECT ON public.anonymized_encounter TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============ RLS ============
ALTER TABLE public.industry_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icd10_code_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practitioner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_proxy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_clinical_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_prescription ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymized_encounter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lookup readable" ON public.industry_lookup FOR SELECT TO authenticated USING (true);
CREATE POLICY "icd readable" ON public.icd10_code_lookup FOR SELECT TO authenticated USING (true);
CREATE POLICY "org readable" ON public.organization FOR SELECT TO authenticated USING (true);
CREATE POLICY "practitioner readable" ON public.practitioner FOR SELECT TO authenticated USING (true);

CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "patient readable" ON public.patient FOR SELECT TO authenticated
  USING (public.can_read_patient(id));
CREATE POLICY "patient self update" ON public.patient FOR UPDATE TO authenticated
  USING (id = public.current_patient_id()) WITH CHECK (id = public.current_patient_id());

CREATE POLICY "consent visible" ON public.consent_grant FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id() OR practitioner_id = public.current_practitioner_id());
CREATE POLICY "consent create" ON public.consent_grant FOR INSERT TO authenticated
  WITH CHECK (patient_id = public.current_patient_id() OR practitioner_id = public.current_practitioner_id());
CREATE POLICY "consent update" ON public.consent_grant FOR UPDATE TO authenticated
  USING (patient_id = public.current_patient_id() OR practitioner_id = public.current_practitioner_id())
  WITH CHECK (patient_id = public.current_patient_id() OR practitioner_id = public.current_practitioner_id());

CREATE POLICY "proxy visible" ON public.patient_proxy FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id() OR proxy_patient_id = public.current_patient_id());
CREATE POLICY "proxy manage" ON public.patient_proxy FOR ALL TO authenticated
  USING (patient_id = public.current_patient_id()) WITH CHECK (patient_id = public.current_patient_id());

CREATE POLICY "records readable" ON public.clinical_record FOR SELECT TO authenticated
  USING (public.can_read_patient(patient_id));
CREATE POLICY "records writable" ON public.clinical_record FOR INSERT TO authenticated
  WITH CHECK (public.can_read_patient(patient_id));
CREATE POLICY "records updatable" ON public.clinical_record FOR UPDATE TO authenticated
  USING (public.can_read_patient(patient_id)) WITH CHECK (public.can_read_patient(patient_id));

CREATE POLICY "visits readable" ON public.visit FOR SELECT TO authenticated
  USING (public.can_read_patient(patient_id));
CREATE POLICY "visits writable" ON public.visit FOR INSERT TO authenticated
  WITH CHECK (public.can_read_patient(patient_id));
CREATE POLICY "visits updatable" ON public.visit FOR UPDATE TO authenticated
  USING (public.can_read_patient(patient_id)) WITH CHECK (public.can_read_patient(patient_id));

CREATE POLICY "vcr readable" ON public.visit_clinical_record FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visit v WHERE v.id = visit_id AND public.can_read_patient(v.patient_id)));
CREATE POLICY "vcr writable" ON public.visit_clinical_record FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.visit v WHERE v.id = visit_id AND public.can_read_patient(v.patient_id)));

CREATE POLICY "rx readable" ON public.drug_prescription FOR SELECT TO authenticated
  USING (public.can_read_patient(patient_id));
CREATE POLICY "rx writable" ON public.drug_prescription FOR INSERT TO authenticated
  WITH CHECK (public.can_read_patient(patient_id));
CREATE POLICY "rx updatable" ON public.drug_prescription FOR UPDATE TO authenticated
  USING (public.can_read_patient(patient_id)) WITH CHECK (public.can_read_patient(patient_id));

CREATE POLICY "obs readable" ON public.observation FOR SELECT TO authenticated
  USING (public.can_read_patient(patient_id));
CREATE POLICY "obs writable" ON public.observation FOR INSERT TO authenticated
  WITH CHECK (public.can_read_patient(patient_id));

CREATE POLICY "analysts read anonymized" ON public.anonymized_encounter FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ANALYST'));

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'PATIENT');
  EXCEPTION WHEN others THEN
    _role := 'PATIENT';
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();