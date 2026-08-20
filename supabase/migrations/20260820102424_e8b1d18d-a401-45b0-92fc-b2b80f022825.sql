REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_patient_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_practitioner_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_consent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_patient(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_patient_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_practitioner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_consent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_patient(uuid) TO authenticated;