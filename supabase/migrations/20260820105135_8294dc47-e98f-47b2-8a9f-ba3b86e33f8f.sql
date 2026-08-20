
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _name text;
BEGIN
  _name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    CONCAT_WS(' ', NEW.raw_user_meta_data->>'given_name', NEW.raw_user_meta_data->>'family_name'),
    NEW.raw_user_meta_data->>'preferred_username',
    NEW.email
  )), '');

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, _name)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'PATIENT');
  EXCEPTION WHEN others THEN
    _role := 'PATIENT';
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_demo_identity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _name text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  INSERT INTO public.profiles(id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;

  SELECT NULLIF(TRIM(COALESCE(full_name, '')), '') INTO _name
    FROM public.profiles WHERE id = _uid;

  IF public.has_role(_uid,'PATIENT') THEN
    SELECT patient_id INTO _pid FROM public.profiles WHERE id = _uid;
    IF _pid IS NULL THEN
      INSERT INTO public.patient(full_name, primary_language)
      VALUES (COALESCE(_name, 'New patient'), 'da')
      RETURNING id INTO _pid;
      UPDATE public.profiles SET patient_id = _pid WHERE id = _uid;
    END IF;
  ELSIF public.has_role(_uid,'PRACTITIONER') THEN
    SELECT practitioner_id INTO _pid FROM public.profiles WHERE id = _uid;
    IF _pid IS NULL THEN
      INSERT INTO public.practitioner(full_name, role, is_verified)
      VALUES (COALESCE(_name, 'New practitioner'), 'DOCTOR', TRUE)
      RETURNING id INTO _pid;
      UPDATE public.profiles SET practitioner_id = _pid WHERE id = _uid;
    END IF;
  END IF;
END;
$$;
