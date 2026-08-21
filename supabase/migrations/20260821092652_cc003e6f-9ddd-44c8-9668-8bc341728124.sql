ALTER TABLE public.visit
  ADD COLUMN IF NOT EXISTS anonymized_encounter_id uuid,
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;