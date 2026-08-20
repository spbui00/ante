-- Lookups
INSERT INTO public.industry_lookup(industry_name) VALUES
 ('Healthcare'),('Education'),('Construction'),('Transport'),('Hospitality'),
 ('Information Technology'),('Agriculture'),('Retail'),('Manufacturing'),('Public Administration'),('Unemployed'),('Student'),('Retired');

INSERT INTO public.icd10_code_lookup(code, chapter, description) VALUES
 ('R05','R','Cough'),('R50','R','Fever of unknown origin'),('R06.0','R','Dyspnoea'),
 ('R07.4','R','Chest pain, unspecified'),('R51','R','Headache'),('R11','R','Nausea and vomiting'),
 ('R53','R','Malaise and fatigue'),('R10.4','R','Abdominal pain'),('R42','R','Dizziness'),
 ('J09','J','Influenza due to identified zoonotic virus'),('J11','J','Influenza, virus not identified'),
 ('J18','J','Pneumonia, unspecified organism'),('J20','J','Acute bronchitis'),('J45','J','Asthma'),
 ('J42','J','Chronic bronchitis'),('U07.1','U','COVID-19'),
 ('E11','E','Type 2 diabetes mellitus'),('I10','I','Essential hypertension'),('I21','I','Acute myocardial infarction'),
 ('I50','I','Heart failure'),('A09','A','Infectious gastroenteritis'),('B34.9','B','Viral infection, unspecified'),
 ('Z86.7','Z','Personal history of diseases of the circulatory system');

-- Organizations
INSERT INTO public.organization(id, name, type, region) VALUES
 ('11111111-1111-1111-1111-111111111101','Rigshospitalet','HOSPITAL','Region Hovedstaden'),
 ('11111111-1111-1111-1111-111111111102','Nørrebro Lægehus','GP_CLINIC','Region Hovedstaden'),
 ('11111111-1111-1111-1111-111111111103','Aarhus Universitetshospital','HOSPITAL','Region Midtjylland');

INSERT INTO public.practitioner(id, organization_id, full_name, role, license_number, is_verified) VALUES
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111102','Dr. Freja Lindqvist','DOCTOR','DK-AUT-449120',TRUE),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111101','Dr. Mikkel Sørensen','DOCTOR','DK-AUT-551803',TRUE),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111101','Nurse Amina Haddad','NURSE','DK-AUT-660214',TRUE),
 ('22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111103','Dr. Jonas Bech','DOCTOR','DK-AUT-770991',TRUE);

-- Patients
INSERT INTO public.patient(id, cpr_number, full_name, date_of_birth, gender, industry, postal_code, primary_language, family_medical_history_icd_codes) VALUES
 ('33333333-3333-3333-3333-333333333301','120589-1234','Jane Smith','1989-05-12','FEMALE','Information Technology','2200','da','["Z82.4"]'),
 ('33333333-3333-3333-3333-333333333302','041158-5678','Elena Petrova','1958-11-04','FEMALE','Retired','2100','da','["Z82.3"]'),
 ('33333333-3333-3333-3333-333333333303','230776-9012','Jamal Wright','1976-07-23','MALE','Transport','2300','en','["Z83.3"]'),
 ('33333333-3333-3333-3333-333333333304','170320-3456','Lily Chen','2020-03-17','FEMALE','Student','2450','da','["Z82.5"]'),
 ('33333333-3333-3333-3333-333333333305','090362-7890','Robert Okafor','1962-03-09','MALE','Construction','2650','en','["Z82.4"]');

-- Clinical records
INSERT INTO public.clinical_record(id, patient_id, category, code, code_system, description, status) VALUES
 ('44444444-4444-4444-4444-444444444401','33333333-3333-3333-3333-333333333301','CONDITION','I10','ICD10','Essential hypertension','ACTIVE'),
 ('44444444-4444-4444-4444-444444444402','33333333-3333-3333-3333-333333333301','ALLERGY',NULL,'SNOMED','No known drug allergies (NKDA)','ACTIVE'),
 ('44444444-4444-4444-4444-444444444403','33333333-3333-3333-3333-333333333302','CONDITION','J18','ICD10','Community-acquired pneumonia, right lower lobe','ACTIVE'),
 ('44444444-4444-4444-4444-444444444404','33333333-3333-3333-3333-333333333302','ALLERGY',NULL,'SNOMED','Penicillin — rash and urticaria','ACTIVE'),
 ('44444444-4444-4444-4444-444444444405','33333333-3333-3333-3333-333333333303','CONDITION','E11','ICD10','Type 2 diabetes mellitus','ACTIVE'),
 ('44444444-4444-4444-4444-444444444406','33333333-3333-3333-3333-333333333303','CONDITION','I10','ICD10','Essential hypertension','ACTIVE'),
 ('44444444-4444-4444-4444-444444444407','33333333-3333-3333-3333-333333333304','CONDITION','J45','ICD10','Mild intermittent asthma','ACTIVE'),
 ('44444444-4444-4444-4444-444444444408','33333333-3333-3333-3333-333333333305','CONDITION','I21','ICD10','ST-elevation myocardial infarction','RESOLVED');

-- Visits
INSERT INTO public.visit(id, patient_id, practitioner_id, visit_date, symptoms, conclusion, recommendation, is_ai_generated, encounter_type, urgency_level, status, symptom_icd_codes, symptom_duration_days, disposition) VALUES
 ('55555555-5555-5555-5555-555555555501','33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222201', now() - interval '2 days','Intermittent chest tightness on exertion, mild dyspnoea, no radiation.','Stable exertional symptoms on a background of hypertension. No red flags today.','Continue antihypertensive therapy, ambulatory BP monitoring, review in 4 weeks.',TRUE,'FOLLOW_UP','MEDIUM','COMPLETED','["R07.4","R06.0"]',9,'HOME_CARE'),
 ('55555555-5555-5555-5555-555555555502','33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222202', now() - interval '1 day','Productive cough, fever 38.2C, right-sided pleuritic pain, SpO2 93% on air.','Community-acquired pneumonia, CURB-65 low-moderate. Penicillin allergy documented.','Doxycycline 7 days, follow-up chest X-ray at 6 weeks, safety-net advice given.',TRUE,'NEW_ISSUE','HIGH_RED_FLAG','COMPLETED','["R05","R50","R06.0"]',4,'PRESCRIPTION'),
 ('55555555-5555-5555-5555-555555555503','33333333-3333-3333-3333-333333333303','22222222-2222-2222-2222-222222222201', now() - interval '5 hours','Non-healing plantar ulcer, no systemic symptoms, glycaemic control suboptimal.','Neuropathic diabetic foot ulcer, no evidence of osteomyelitis.','Offloading footwear, weekly wound review, intensify glucose-lowering therapy.',TRUE,'CHRONIC_FLARE_UP','MEDIUM','IN_PROGRESS','["R53"]',21,NULL),
 ('55555555-5555-5555-5555-555555555504','33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222203', now() - interval '3 hours','Night-time cough and wheeze, worse after running, responsive to salbutamol.','Mild intermittent asthma, well controlled between episodes.','Continue reliever, add spacer technique review, asthma action plan issued.',TRUE,'FOLLOW_UP','LOW','SCHEDULED','["R05","R06.0"]',14,NULL),
 ('55555555-5555-5555-5555-555555555505','33333333-3333-3333-3333-333333333305','22222222-2222-2222-2222-222222222204', now() - interval '30 minutes','Crushing central chest pain radiating to left arm, diaphoresis, onset 40 minutes ago.','Suspected acute coronary syndrome — awaiting troponin and ECG confirmation.','Immediate transfer to PCI centre, dual antiplatelet loading pending allergy check.',TRUE,'NEW_ISSUE','HIGH_RED_FLAG','IN_PROGRESS','["R07.4","R53"]',1,'ER_REFERRAL');

INSERT INTO public.visit_clinical_record(visit_id, clinical_record_id, role_in_visit) VALUES
 ('55555555-5555-5555-5555-555555555501','44444444-4444-4444-4444-444444444401','FOLLOW_UP'),
 ('55555555-5555-5555-5555-555555555502','44444444-4444-4444-4444-444444444403','DIAGNOSED'),
 ('55555555-5555-5555-5555-555555555503','44444444-4444-4444-4444-444444444405','FOLLOW_UP'),
 ('55555555-5555-5555-5555-555555555504','44444444-4444-4444-4444-444444444407','FOLLOW_UP'),
 ('55555555-5555-5555-5555-555555555505','44444444-4444-4444-4444-444444444408','DIAGNOSED');

INSERT INTO public.drug_prescription(patient_id, visit_id, clinical_record_id, drug_name, atc_code, dosage, frequency, start_date) VALUES
 ('33333333-3333-3333-3333-333333333301','55555555-5555-5555-5555-555555555501','44444444-4444-4444-4444-444444444401','Amlodipine','C08CA01','5 mg','ONCE_DAILY', CURRENT_DATE - 120),
 ('33333333-3333-3333-3333-333333333302','55555555-5555-5555-5555-555555555502','44444444-4444-4444-4444-444444444403','Doxycycline','J01AA02','100 mg','TWICE_DAILY', CURRENT_DATE - 1),
 ('33333333-3333-3333-3333-333333333303','55555555-5555-5555-5555-555555555503','44444444-4444-4444-4444-444444444405','Metformin','A10BA02','1000 mg','TWICE_DAILY', CURRENT_DATE - 900),
 ('33333333-3333-3333-3333-333333333303',NULL,'44444444-4444-4444-4444-444444444406','Losartan','C09CA01','50 mg','ONCE_DAILY', CURRENT_DATE - 400),
 ('33333333-3333-3333-3333-333333333304','55555555-5555-5555-5555-555555555504','44444444-4444-4444-4444-444444444407','Salbutamol inhaler','R03AC02','100 mcg','PRN', CURRENT_DATE - 60),
 ('33333333-3333-3333-3333-333333333305',NULL,'44444444-4444-4444-4444-444444444408','Atorvastatin','C10AA05','80 mg','ONCE_DAILY', CURRENT_DATE - 30);

INSERT INTO public.observation(patient_id, visit_id, loinc_code, test_name, value, unit, source, recorded_at) VALUES
 ('33333333-3333-3333-3333-333333333301','55555555-5555-5555-5555-555555555501','8480-6','Systolic blood pressure',138,'mmHg','Nørrebro Lægehus', now() - interval '2 days'),
 ('33333333-3333-3333-3333-333333333301','55555555-5555-5555-5555-555555555501','2093-3','Total cholesterol',5.4,'mmol/L','Nørrebro Lægehus', now() - interval '2 days'),
 ('33333333-3333-3333-3333-333333333302','55555555-5555-5555-5555-555555555502','1988-5','C-reactive protein',94,'mg/L','Rigshospitalet', now() - interval '1 day'),
 ('33333333-3333-3333-3333-333333333302','55555555-5555-5555-5555-555555555502','6690-2','Leukocytes',14.2,'10*9/L','Rigshospitalet', now() - interval '1 day'),
 ('33333333-3333-3333-3333-333333333303','55555555-5555-5555-5555-555555555503','4548-4','Hemoglobin A1c',8.4,'%','Nørrebro Lægehus', now() - interval '5 hours'),
 ('33333333-3333-3333-3333-333333333304','55555555-5555-5555-5555-555555555504','2708-6','Oxygen saturation',98,'%','Rigshospitalet', now() - interval '3 hours'),
 ('33333333-3333-3333-3333-333333333305','55555555-5555-5555-5555-555555555505','10839-9','Troponin I',2.7,'ug/L','Aarhus Universitetshospital', now() - interval '20 minutes');

INSERT INTO public.consent_grant(patient_id, practitioner_id, status, granted_at, expires_at) VALUES
 ('33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222201','ACTIVE', now() - interval '30 days', now() + interval '300 days'),
 ('33333333-3333-3333-3333-333333333303','22222222-2222-2222-2222-222222222201','ACTIVE', now() - interval '30 days', now() + interval '300 days'),
 ('33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222201','ACTIVE', now() - interval '2 days', now() + interval '20 days'),
 ('33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222201','PENDING', NULL, NULL),
 ('33333333-3333-3333-3333-333333333305','22222222-2222-2222-2222-222222222201','ACTIVE', now() - interval '1 hour', now() + interval '1 day');

INSERT INTO public.anonymized_encounter
 (encounter_date, year, month, day_of_week, hour_of_day, postal_code, age_bracket, gender, industry,
  is_pregnant, weather_conditions, primary_icd_10, secondary_icd_10_codes, symptom_icd_codes,
  clinical_history_icd_codes, observations_loinc, prescription_atc_codes, encounter_type,
  symptom_duration_category, travel_history, urgency_level, disposition)
SELECT
  s.d,
  EXTRACT(YEAR FROM s.d)::int,
  EXTRACT(MONTH FROM s.d)::int,
  to_char(s.d,'Dy'),
  (7 + (i % 12)),
  (ARRAY['2200','2100','2300','2450','2650','8000','5000','9000'])[1 + (i % 8)],
  (ARRAY['0-9','10-19','20-39','40-59','60-79','80+'])[1 + (i % 6)],
  (ARRAY['FEMALE','MALE'])[1 + (i % 2)],
  (ARRAY['Healthcare','Education','Construction','Transport','Retail','Student','Retired','Information Technology'])[1 + (i % 8)],
  FALSE,
  jsonb_build_object('temp_c', 4 + (i % 18), 'humidity', 60 + (i % 30)),
  (ARRAY['J11','J20','J18','U07.1','A09','J45','E11','I10','B34.9','R50'])[1 + ((i * 3) % 10)],
  '[]'::jsonb,
  (ARRAY['["R05","R50"]','["R06.0"]','["R51","R53"]','["R11","R10.4"]','["R07.4"]'])[1 + (i % 5)]::jsonb,
  '[]'::jsonb,
  jsonb_build_object('1988-5', 5 + (i % 90)),
  (ARRAY['["J01"]','["R03"]','["N02"]','["A10"]'])[1 + (i % 4)]::jsonb,
  (ARRAY['NEW_ISSUE','FOLLOW_UP','CHRONIC_FLARE_UP'])[1 + (i % 3)]::public.encounter_type_enum,
  (ARRAY['<3 days','3-7 days','1-4 weeks','>1 month'])[1 + (i % 4)],
  '[]'::jsonb,
  (ARRAY['LOW','LOW','MEDIUM','MEDIUM','HIGH_RED_FLAG'])[1 + (i % 5)]::public.urgency_enum,
  (ARRAY['HOME_CARE','PRESCRIPTION','ER_REFERRAL'])[1 + (i % 3)]::public.disposition_enum
FROM generate_series(0, 599) AS i,
LATERAL (SELECT (now() - (i % 90) * interval '1 day' - (i % 11) * interval '1 hour') AS d) s;

CREATE OR REPLACE FUNCTION public.claim_demo_identity()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  INSERT INTO public.profiles(id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;

  IF public.has_role(_uid,'PATIENT') THEN
    SELECT patient_id INTO _pid FROM public.profiles WHERE id = _uid;
    IF _pid IS NULL THEN
      SELECT p.id INTO _pid FROM public.patient p
       WHERE NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.patient_id = p.id)
       ORDER BY p.created_at LIMIT 1;
      IF _pid IS NULL THEN
        INSERT INTO public.patient(full_name, primary_language)
        VALUES (COALESCE((SELECT full_name FROM public.profiles WHERE id=_uid),'New patient'),'da')
        RETURNING id INTO _pid;
      END IF;
      UPDATE public.profiles SET patient_id = _pid WHERE id = _uid;
    END IF;
  ELSIF public.has_role(_uid,'PRACTITIONER') THEN
    SELECT practitioner_id INTO _pid FROM public.profiles WHERE id = _uid;
    IF _pid IS NULL THEN
      SELECT p.id INTO _pid FROM public.practitioner p
       WHERE NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.practitioner_id = p.id)
       ORDER BY p.created_at LIMIT 1;
      IF _pid IS NULL THEN
        INSERT INTO public.practitioner(full_name, role, is_verified)
        VALUES (COALESCE((SELECT full_name FROM public.profiles WHERE id=_uid),'New practitioner'),'DOCTOR',TRUE)
        RETURNING id INTO _pid;
      END IF;
      UPDATE public.profiles SET practitioner_id = _pid WHERE id = _uid;
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_demo_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_demo_identity() TO authenticated;