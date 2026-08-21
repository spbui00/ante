-- De-identified surveillance view (no identifiers, no embeddings)
CREATE OR REPLACE VIEW public.surveillance_encounter
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.encounter_date,
  (e.encounter_date)::date AS encounter_day,
  e.year,
  e.month,
  e.day_of_week,
  e.hour_of_day,
  e.postal_code,
  e.age_bracket,
  e.industry,
  e.is_pregnant,
  e.weather_conditions,
  e.primary_icd_10,
  e.secondary_icd_10_codes,
  e.symptom_icd_codes,
  e.clinical_history_icd_codes,
  e.observations_loinc,
  e.prescription_atc_codes,
  e.encounter_type,
  e.symptom_duration_category,
  e.travel_history,
  e.urgency_level,
  e.disposition,
  e.sex,
  e.gender_identity,
  e.race_ethnicity,
  e.primary_language,
  e.marital_status,
  e.employment_status,
  e.insurance_type
FROM public.anonymized_encounter e;

GRANT SELECT ON public.surveillance_encounter TO authenticated;
GRANT SELECT ON public.surveillance_encounter TO service_role;

-- Read-only query helper. SECURITY INVOKER: RLS still applies as the caller.
CREATE OR REPLACE FUNCTION public.analytics_query(_sql text, _limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
declare
  _clean text := btrim(coalesce(_sql, ''));
  _lower text;
  _rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- strip a single trailing semicolon, then reject any remaining statement break
  _clean := regexp_replace(_clean, ';\s*$', '');
  if _clean = '' then
    raise exception 'Empty query';
  end if;
  if position(';' in _clean) > 0 then
    raise exception 'Only a single statement is allowed';
  end if;

  _lower := lower(_clean);
  if _lower !~ '^(select|with)\s' then
    raise exception 'Only SELECT/WITH queries are allowed';
  end if;
  if _lower ~ '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|vacuum|call|do|merge|refresh|comment|set|reset|listen|notify|lock|prepare|execute|analyze|reindex|cluster|security|pg_read_file|pg_ls_dir|dblink|pg_sleep)\M' then
    raise exception 'Query contains a forbidden keyword';
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from (%s) q limit %s) t',
    _clean,
    greatest(1, least(coalesce(_limit, 500), 2000))
  ) into _rows;

  return _rows;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_query(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_query(text, integer) TO service_role;

-- Saved / pinned analytics cards
CREATE TABLE public.analytics_card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  kind text NOT NULL,
  sql_query text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  window_days integer NOT NULL DEFAULT 60,
  position integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_card_owner_idx ON public.analytics_card(owner_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_card TO authenticated;
GRANT ALL ON public.analytics_card TO service_role;

ALTER TABLE public.analytics_card ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their own analytics cards"
ON public.analytics_card FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());