GRANT DELETE ON public.visit TO authenticated;

CREATE POLICY "Patients can delete their own scheduled drafts"
ON public.visit
FOR DELETE
TO authenticated
USING (
  patient_id = public.current_patient_id()
  AND status = 'SCHEDULED'
  AND practitioner_id IS NULL
);