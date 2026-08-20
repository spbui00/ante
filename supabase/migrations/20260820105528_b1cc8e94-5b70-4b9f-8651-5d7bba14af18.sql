
CREATE OR REPLACE FUNCTION public.apply_onboarding(
  _role public.app_role,
  _full_name text DEFAULT NULL,
  _license text DEFAULT NULL,
  _practitioner_role public.practitioner_role_enum DEFAULT 'DOCTOR',
  _verified boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _pid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.profiles(id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;

  IF NULLIF(TRIM(COALESCE(_full_name,'')),'') IS NOT NULL THEN
    UPDATE public.profiles SET full_name = TRIM(_full_name) WHERE id = _uid;
  END IF;

  SELECT NULLIF(TRIM(COALESCE(full_name,'')),'') INTO _name FROM public.profiles WHERE id = _uid;

  DELETE FROM public.user_roles WHERE user_id = _uid;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _role = 'PRACTITIONER' THEN
    SELECT practitioner_id INTO _pid FROM public.profiles WHERE id = _uid;
    IF _pid IS NULL THEN
      INSERT INTO public.practitioner(full_name, role, license_number, is_verified)
      VALUES (COALESCE(_name,'New practitioner'), COALESCE(_practitioner_role,'DOCTOR'), _license, COALESCE(_verified,false))
      RETURNING id INTO _pid;
      UPDATE public.profiles SET practitioner_id = _pid WHERE id = _uid;
    ELSE
      UPDATE public.practitioner
         SET full_name = COALESCE(_name, full_name),
             role = COALESCE(_practitioner_role, role),
             license_number = COALESCE(_license, license_number),
             is_verified = COALESCE(_verified, is_verified)
       WHERE id = _pid;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_onboarding(public.app_role, text, text, public.practitioner_role_enum, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_onboarding(public.app_role, text, text, public.practitioner_role_enum, boolean) TO authenticated, service_role;
