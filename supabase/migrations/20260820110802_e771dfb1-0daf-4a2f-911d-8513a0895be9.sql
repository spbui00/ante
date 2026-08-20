ALTER TABLE public.practitioner
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS specialization text;

UPDATE public.practitioner
SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')),
    last_name = COALESCE(last_name, NULLIF(substring(full_name from position(' ' in full_name) + 1), ''))
WHERE first_name IS NULL OR last_name IS NULL;

DROP POLICY IF EXISTS "practitioner self update" ON public.practitioner;
CREATE POLICY "practitioner self update" ON public.practitioner
  FOR UPDATE TO authenticated
  USING (id = public.current_practitioner_id())
  WITH CHECK (id = public.current_practitioner_id());

CREATE OR REPLACE FUNCTION public.apply_onboarding(
  _role app_role,
  _full_name text DEFAULT NULL::text,
  _license text DEFAULT NULL::text,
  _practitioner_role practitioner_role_enum DEFAULT 'DOCTOR'::practitioner_role_enum,
  _verified boolean DEFAULT false,
  _first_name text DEFAULT NULL::text,
  _last_name text DEFAULT NULL::text,
  _title text DEFAULT NULL::text,
  _specialization text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.practitioner(full_name, role, license_number, is_verified, first_name, last_name, title, specialization)
      VALUES (COALESCE(_name,'New practitioner'), COALESCE(_practitioner_role,'DOCTOR'), _license, COALESCE(_verified,false),
              NULLIF(TRIM(COALESCE(_first_name,'')),''), NULLIF(TRIM(COALESCE(_last_name,'')),''),
              NULLIF(TRIM(COALESCE(_title,'')),''), NULLIF(TRIM(COALESCE(_specialization,'')),''))
      RETURNING id INTO _pid;
      UPDATE public.profiles SET practitioner_id = _pid WHERE id = _uid;
    ELSE
      UPDATE public.practitioner
         SET full_name = COALESCE(_name, full_name),
             role = COALESCE(_practitioner_role, role),
             license_number = COALESCE(_license, license_number),
             is_verified = COALESCE(_verified, is_verified),
             first_name = COALESCE(NULLIF(TRIM(COALESCE(_first_name,'')),''), first_name),
             last_name = COALESCE(NULLIF(TRIM(COALESCE(_last_name,'')),''), last_name),
             title = COALESCE(NULLIF(TRIM(COALESCE(_title,'')),''), title),
             specialization = COALESCE(NULLIF(TRIM(COALESCE(_specialization,'')),''), specialization)
       WHERE id = _pid;
    END IF;
  END IF;
END;
$function$;