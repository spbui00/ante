REVOKE EXECUTE ON FUNCTION public.owns_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_visit(uuid) TO authenticated;