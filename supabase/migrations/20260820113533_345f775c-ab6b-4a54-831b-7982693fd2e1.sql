TRUNCATE TABLE
  public.visit_clinical_record,
  public.drug_prescription,
  public.observation,
  public.clinical_record,
  public.visit,
  public.patient_care_team,
  public.patient_proxy,
  public.consent_grant,
  public.anonymized_encounter,
  public.profiles,
  public.user_roles,
  public.patient,
  public.practitioner,
  public.organization
RESTART IDENTITY CASCADE;