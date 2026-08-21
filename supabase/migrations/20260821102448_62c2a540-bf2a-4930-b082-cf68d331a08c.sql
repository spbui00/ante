DROP POLICY "analysts read anonymized" ON public.anonymized_encounter;
CREATE POLICY "authenticated users read anonymized" ON public.anonymized_encounter FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.anonymized_encounter TO authenticated;