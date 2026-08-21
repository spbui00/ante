
DO $$
DECLARE
  p_id uuid := '2f01872d-2b62-4285-b489-68d5f67bf29c';
  d_gp uuid := '841c85ba-3b9f-43cd-afc6-1143709eee1b'; -- Elena Vasquez, Internal Medicine
  d_pul uuid := '1ac245a4-de82-4686-8426-a0cc6ff0c7ce'; -- Rachel Torres, Pulmonology
  d_neu uuid := '1bcfeebc-f39c-4a8c-9ead-190810e255f1'; -- Victor Lane, Neurology
  d_han uuid := 'bf620c1d-87f8-4876-abe9-a6870aa9246d';
  v1 uuid := gen_random_uuid();
  v2 uuid := gen_random_uuid();
  v3 uuid := gen_random_uuid();
  cr_asthma uuid := gen_random_uuid();
  cr_migraine uuid := gen_random_uuid();
  cr_rhinitis uuid := gen_random_uuid();
  cr_pen uuid := gen_random_uuid();
  cr_nsaid uuid := gen_random_uuid();
  cr_pollen uuid := gen_random_uuid();
  cr_rsi uuid := gen_random_uuid();
BEGIN
  -- Fresh start for the intake demo: James is not yet linked to Dr. Han Solo
  DELETE FROM public.patient_care_team WHERE patient_id = p_id AND practitioner_id = d_han;
  DELETE FROM public.consent_grant WHERE patient_id = p_id AND practitioner_id = d_han;

  -- Care team
  INSERT INTO public.patient_care_team (patient_id, practitioner_id, specialization, is_primary, status, assigned_at, notes)
  VALUES
    (p_id, d_gp,  'Internal Medicine', true,  'ACTIVE', '2019-09-02T09:00:00Z', 'Primary physician since university years.'),
    (p_id, d_pul, 'Pulmonology',       false, 'ACTIVE', '2021-03-18T10:30:00Z', 'Manages mild persistent asthma.'),
    (p_id, d_neu, 'Neurology',         false, 'ACTIVE', '2023-11-07T14:00:00Z', 'Migraine with aura, preventive therapy.')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.consent_grant (patient_id, practitioner_id, status, is_emergency_override, granted_at)
  VALUES
    (p_id, d_gp,  'ACTIVE', false, '2019-09-02T09:00:00Z'),
    (p_id, d_pul, 'ACTIVE', false, '2021-03-18T10:30:00Z'),
    (p_id, d_neu, 'ACTIVE', false, '2023-11-07T14:00:00Z');

  -- Past visits
  INSERT INTO public.visit (id, patient_id, practitioner_id, visit_date, symptoms, conclusion, recommendation,
                            encounter_type, urgency_level, status, disposition, completed_at, is_ai_generated)
  VALUES
    (v1, p_id, d_pul, '2025-10-14T09:20:00Z',
     'Night-time cough and chest tightness 3–4 nights per week, worse after cycling in cold air. Reliever inhaler used most days.',
     '**Mild persistent asthma**, poorly controlled (ACT 17). Spirometry shows reversible obstruction (FEV1 82% predicted, +14% post-bronchodilator).',
     'Step up to daily inhaled corticosteroid (budesonide/formoterol 160/4.5 µg, 1 puff BID). Reliever as needed. Review in 3 months with repeat ACT.',
     'CHRONIC_FLARE_UP', 'MEDIUM', 'COMPLETED', 'PRESCRIPTION', '2025-10-14T09:55:00Z', false),
    (v2, p_id, d_neu, '2026-02-03T13:10:00Z',
     'Two to three migraine attacks per month with visual aura, photophobia and nausea. Attacks often follow long screen-work sessions and poor sleep.',
     '**Migraine with aura** (G43.1), episodic. Neurological examination normal, no red flags. Screen-time and sleep debt identified as principal triggers.',
     'Start propranolol 40 mg BID as prevention. Sumatriptan 50 mg at onset, max 2 doses/24h. Headache diary, 20-20-20 screen breaks, consistent sleep window.',
     'NEW_ISSUE', 'MEDIUM', 'COMPLETED', 'PRESCRIPTION', '2026-02-03T13:50:00Z', false),
    (v3, p_id, d_gp, '2026-05-21T10:00:00Z',
     'Annual check-up. No acute complaints. Reports asthma well controlled, migraines reduced to ~1 per month on propranolol. Sedentary desk work, cycles to office.',
     'Well 28-year-old male. Asthma controlled (ACT 23). Migraine frequency halved on prophylaxis. Lipids and HbA1c normal; mild vitamin D insufficiency.',
     'Continue current inhaler and propranolol. Vitamin D 25 µg daily through winter. Repeat lipid panel and vitamin D in 12 months. Keep up cycling; add two strength sessions weekly.',
     'FOLLOW_UP', 'LOW', 'COMPLETED', 'HOME_CARE', '2026-05-21T10:35:00Z', false);

  -- Conditions & allergies
  INSERT INTO public.clinical_record (id, patient_id, visit_id, category, code, code_system, description, status, created_at)
  VALUES
    (cr_asthma,   p_id, v1,   'CONDITION', 'J45.3', 'ICD10', 'Mild persistent asthma, exercise- and cold-air triggered', 'ACTIVE',   '2021-03-18T10:40:00Z'),
    (cr_migraine, p_id, v2,   'CONDITION', 'G43.1', 'ICD10', 'Migraine with aura, episodic (2–3 attacks/month)',          'ACTIVE',   '2026-02-03T13:30:00Z'),
    (cr_rhinitis, p_id, NULL, 'CONDITION', 'J30.1', 'ICD10', 'Seasonal allergic rhinitis (grass and birch pollen)',       'ACTIVE',   '2019-05-11T08:00:00Z'),
    (cr_rsi,      p_id, NULL, 'CONDITION', 'M70.8', 'ICD10', 'Right wrist tenosynovitis from prolonged keyboard use',     'RESOLVED', '2024-08-19T09:00:00Z'),
    (cr_pen,      p_id, NULL, 'ALLERGY',   'Z88.0', 'ICD10', '**Penicillin** — urticarial rash and facial swelling, age 12', 'ACTIVE', '2010-06-04T00:00:00Z'),
    (cr_nsaid,    p_id, NULL, 'ALLERGY',   'Z88.6', 'ICD10', '**Ibuprofen / NSAIDs** — bronchospasm and wheeze (avoid, use paracetamol)', 'ACTIVE', '2021-04-02T00:00:00Z'),
    (cr_pollen,   p_id, NULL, 'ALLERGY',   'T78.4', 'ICD10', 'Grass and birch pollen — sneezing, itchy eyes (spring/summer)', 'ACTIVE', '2019-05-11T08:00:00Z');

  INSERT INTO public.visit_clinical_record (visit_id, clinical_record_id, role_in_visit)
  VALUES (v1, cr_asthma, 'DIAGNOSED'), (v2, cr_migraine, 'DIAGNOSED'), (v3, cr_asthma, 'FOLLOW_UP')
  ON CONFLICT DO NOTHING;

  -- Medications
  INSERT INTO public.drug_prescription (patient_id, visit_id, clinical_record_id, drug_name, atc_code, dosage, frequency, start_date, end_date)
  VALUES
    (p_id, v1,   cr_asthma,   'Budesonide/Formoterol inhaler', 'R03AK07', '160/4.5 µg', '1 puff twice daily',        '2025-10-14', NULL),
    (p_id, NULL, cr_asthma,   'Salbutamol inhaler',            'R03AC02', '100 µg',     'As needed, max 8 puffs/day', '2021-03-18', NULL),
    (p_id, v2,   cr_migraine, 'Propranolol',                   'C07AA05', '40 mg',      'Twice daily',                '2026-02-03', NULL),
    (p_id, v2,   cr_migraine, 'Sumatriptan',                   'N02CC01', '50 mg',      'At migraine onset, max 2/24h','2026-02-03', NULL),
    (p_id, v3,   NULL,        'Cetirizine',                    'R06AE07', '10 mg',      'Once daily during pollen season', '2019-05-11', NULL),
    (p_id, v3,   NULL,        'Colecalciferol (vitamin D)',    'A11CC05', '25 µg',      'Once daily',                 '2026-05-21', NULL),
    (p_id, NULL, cr_rsi,      'Naproxen gel',                  'M02AA12', '10%',        'Apply 3 times daily',        '2024-08-19', '2024-09-16');

  -- Observations
  INSERT INTO public.observation (patient_id, visit_id, loinc_code, test_name, value, unit, source, recorded_at, status, ordered_date)
  VALUES
    (p_id, v1, '19926-5', 'FEV1 % predicted (post-bronchodilator)', 94,   '%',      'Spirometry',   '2025-10-14T09:35:00Z', 'RESULTED', NULL),
    (p_id, v1, '8867-4',  'Heart rate',                              78,   'bpm',    'Clinic',       '2025-10-14T09:25:00Z', 'RESULTED', NULL),
    (p_id, v1, '2708-6',  'Oxygen saturation',                       98,   '%',      'Clinic',       '2025-10-14T09:25:00Z', 'RESULTED', NULL),
    (p_id, v2, '8480-6',  'Systolic blood pressure',                 118,  'mmHg',   'Clinic',       '2026-02-03T13:15:00Z', 'RESULTED', NULL),
    (p_id, v2, '8462-4',  'Diastolic blood pressure',                74,   'mmHg',   'Clinic',       '2026-02-03T13:15:00Z', 'RESULTED', NULL),
    (p_id, v3, '8480-6',  'Systolic blood pressure',                 122,  'mmHg',   'Clinic',       '2026-05-21T10:05:00Z', 'RESULTED', NULL),
    (p_id, v3, '8462-4',  'Diastolic blood pressure',                78,   'mmHg',   'Clinic',       '2026-05-21T10:05:00Z', 'RESULTED', NULL),
    (p_id, v3, '8867-4',  'Heart rate',                              62,   'bpm',    'Clinic',       '2026-05-21T10:05:00Z', 'RESULTED', NULL),
    (p_id, v3, '29463-7', 'Body weight',                             79.5, 'kg',     'Clinic',       '2026-05-21T10:05:00Z', 'RESULTED', NULL),
    (p_id, v3, '39156-5', 'Body mass index',                         24.1, 'kg/m2',  'Clinic',       '2026-05-21T10:05:00Z', 'RESULTED', NULL),
    (p_id, v3, '4548-4',  'HbA1c',                                   33,   'mmol/mol','Laboratory',  '2026-05-22T08:10:00Z', 'RESULTED', NULL),
    (p_id, v3, '2093-3',  'Total cholesterol',                       4.4,  'mmol/L', 'Laboratory',   '2026-05-22T08:10:00Z', 'RESULTED', NULL),
    (p_id, v3, '2085-9',  'HDL cholesterol',                         1.4,  'mmol/L', 'Laboratory',   '2026-05-22T08:10:00Z', 'RESULTED', NULL),
    (p_id, v3, '13457-7', 'LDL cholesterol',                         2.5,  'mmol/L', 'Laboratory',   '2026-05-22T08:10:00Z', 'RESULTED', NULL),
    (p_id, v3, '718-7',   'Haemoglobin',                             9.1,  'mmol/L', 'Laboratory',   '2026-05-22T08:10:00Z', 'RESULTED', NULL),
    (p_id, v3, '1989-3',  'Vitamin D (25-OH)',                       42,   'nmol/L', 'Laboratory',   '2026-05-22T08:10:00Z', 'RESULTED', NULL),
    (p_id, v3, '1989-3',  'Vitamin D (25-OH) — repeat',              NULL, 'nmol/L', 'Laboratory',   '2026-05-21T10:30:00Z', 'ORDERED',  '2026-05-21');
END $$;
