-- Give every demo patient a CPR number derived from their date of birth
UPDATE public.patient p
SET cpr_number = to_char(p.date_of_birth, 'DDMMYY') || '-' ||
  lpad(((abs(hashtext(p.id::text)) % 9000) + 1000)::text, 4, '0')
WHERE (p.cpr_number IS NULL OR p.cpr_number = '') AND p.date_of_birth IS NOT NULL;

-- Practitioner requests access to a patient identified by CPR
CREATE OR REPLACE FUNCTION public.request_consent_by_cpr(_cpr text, _duration interval)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prac uuid;
  _patient public.patient%ROWTYPE;
  _existing public.consent_grant%ROWTYPE;
  _id uuid;
BEGIN
  _prac := public.current_practitioner_id();
  IF _prac IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_practitioner');
  END IF;

  SELECT * INTO _patient FROM public.patient
   WHERE replace(cpr_number, '-', '') = replace(trim(_cpr), '-', '')
   LIMIT 1;

  IF _patient.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO _existing FROM public.consent_grant
   WHERE patient_id = _patient.id AND practitioner_id = _prac
     AND status IN ('PENDING', 'ACTIVE')
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at DESC LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', lower(_existing.status::text),
                              'patient_name', _patient.full_name);
  END IF;

  INSERT INTO public.consent_grant (patient_id, practitioner_id, status, is_emergency_override, expires_at)
  VALUES (_patient.id, _prac, 'PENDING', false, now() + _duration)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'patient_name', _patient.full_name);
END;
$$;

REVOKE ALL ON FUNCTION public.request_consent_by_cpr(text, interval) FROM public;
GRANT EXECUTE ON FUNCTION public.request_consent_by_cpr(text, interval) TO authenticated;