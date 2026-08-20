CREATE OR REPLACE FUNCTION public.break_glass_by_cpr(_cpr text, _justification text, _duration interval)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prac uuid;
  _patient public.patient%ROWTYPE;
  _id uuid;
BEGIN
  _prac := public.current_practitioner_id();
  IF _prac IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_practitioner');
  END IF;

  IF _justification IS NULL OR length(trim(_justification)) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'justification_too_short');
  END IF;

  SELECT * INTO _patient FROM public.patient
   WHERE replace(cpr_number, '-', '') = replace(trim(_cpr), '-', '')
   LIMIT 1;

  IF _patient.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.consent_grant
     SET status = 'REVOKED'
   WHERE patient_id = _patient.id AND practitioner_id = _prac
     AND status = 'PENDING';

  INSERT INTO public.consent_grant (patient_id, practitioner_id, status, is_emergency_override, justification_notes, granted_at, expires_at)
  VALUES (_patient.id, _prac, 'ACTIVE', true, trim(_justification), now(), now() + _duration)
  RETURNING id INTO _id;

  INSERT INTO public.patient_care_team (patient_id, practitioner_id)
  VALUES (_patient.id, _prac)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'patient_name', _patient.full_name);
END;
$$;

REVOKE ALL ON FUNCTION public.break_glass_by_cpr(text, text, interval) FROM public;
GRANT EXECUTE ON FUNCTION public.break_glass_by_cpr(text, text, interval) TO authenticated;