CREATE POLICY "care team deletable by practitioner" ON public.patient_care_team
  FOR DELETE TO authenticated
  USING (practitioner_id = public.current_practitioner_id());