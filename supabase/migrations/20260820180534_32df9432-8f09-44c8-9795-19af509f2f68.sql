ALTER TABLE public.clinical_record ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.visit(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clinical_record_visit_id_idx ON public.clinical_record(visit_id);
CREATE INDEX IF NOT EXISTS observation_visit_id_idx ON public.observation(visit_id);
CREATE INDEX IF NOT EXISTS drug_prescription_visit_id_idx ON public.drug_prescription(visit_id);

CREATE OR REPLACE FUNCTION public.owns_visit(_visit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visit v
    WHERE v.id = _visit_id
      AND v.practitioner_id IS NOT NULL
      AND v.practitioner_id = public.current_practitioner_id()
  );
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.observation TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drug_prescription TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_record TO authenticated;
GRANT ALL ON public.observation TO service_role;
GRANT ALL ON public.drug_prescription TO service_role;
GRANT ALL ON public.clinical_record TO service_role;

DROP POLICY IF EXISTS "obs updatable by visit owner" ON public.observation;
CREATE POLICY "obs updatable by visit owner" ON public.observation
  FOR UPDATE TO authenticated
  USING (visit_id IS NOT NULL AND public.owns_visit(visit_id))
  WITH CHECK (visit_id IS NOT NULL AND public.owns_visit(visit_id));

DROP POLICY IF EXISTS "obs deletable by visit owner" ON public.observation;
CREATE POLICY "obs deletable by visit owner" ON public.observation
  FOR DELETE TO authenticated
  USING (visit_id IS NOT NULL AND public.owns_visit(visit_id));

DROP POLICY IF EXISTS "rx deletable by visit owner" ON public.drug_prescription;
CREATE POLICY "rx deletable by visit owner" ON public.drug_prescription
  FOR DELETE TO authenticated
  USING (visit_id IS NOT NULL AND public.owns_visit(visit_id));

DROP POLICY IF EXISTS "records deletable by visit owner" ON public.clinical_record;
CREATE POLICY "records deletable by visit owner" ON public.clinical_record
  FOR DELETE TO authenticated
  USING (visit_id IS NOT NULL AND public.owns_visit(visit_id));