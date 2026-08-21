DROP FUNCTION IF EXISTS public.outbreak_stats(integer);

CREATE OR REPLACE FUNCTION public.outbreak_stats(_days integer DEFAULT 180, _focus text[] DEFAULT ARRAY['U07'])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _since timestamptz := now() - make_interval(days => _days);
  _res jsonb;
  _f text[] := coalesce(nullif(_focus, '{}'), ARRAY['U07']);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  with base as (
    select
      e.id,
      e.encounter_date,
      e.postal_code,
      e.age_bracket,
      e.primary_icd_10,
      e.symptom_icd_codes,
      e.urgency_level,
      e.disposition,
      (
        exists (
          select 1 from unnest(_f) p
          where e.primary_icd_10 like p || '%'
        )
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(e.symptom_icd_codes, '[]'::jsonb)) s
          join unnest(_f) p on s like p || '%'
        )
      ) as is_focus,
      case
        when e.primary_icd_10 like 'U07%' or e.primary_icd_10 like 'J%'
          or e.symptom_icd_codes ? 'R05' or e.symptom_icd_codes ? 'R06.0'
          or e.symptom_icd_codes ? 'R06.2' or e.symptom_icd_codes ? 'R07.0'
          then 'RESPIRATORY'
        when e.symptom_icd_codes ? 'R11.0' or e.symptom_icd_codes ? 'R11.1'
          or e.symptom_icd_codes ? 'R19.7'
          then 'GASTROINTESTINAL'
        when e.symptom_icd_codes ? 'R50' or e.symptom_icd_codes ? 'R50.9'
          then 'FEBRILE'
        else 'OTHER'
      end as syndrome
    from public.anonymized_encounter e
    where e.encounter_date >= _since
  ),
  daily as (
    select
      (date_trunc('day', encounter_date))::date as d,
      count(*) as total,
      count(*) filter (where is_focus) as focus,
      count(*) filter (where syndrome = 'RESPIRATORY') as respiratory,
      count(*) filter (where syndrome = 'GASTROINTESTINAL') as gastro,
      count(*) filter (where syndrome = 'FEBRILE') as febrile,
      count(*) filter (where urgency_level = 'HIGH_RED_FLAG') as red_flag,
      count(*) filter (where disposition = 'ER_REFERRAL') as er
    from base group by 1 order by 1
  ),
  postal as (
    select
      coalesce(postal_code, 'unknown') as postal_code,
      count(*) filter (where encounter_date >= now() - interval '14 days') as recent,
      count(*) filter (where encounter_date >= now() - interval '28 days'
                         and encounter_date < now() - interval '14 days') as prior,
      count(*) filter (where encounter_date >= now() - interval '14 days'
                         and is_focus) as recent_focus
    from base group by 1
  ),
  codes as (
    select code, count(*) filter (where recent) as recent, count(*) filter (where not recent) as prior
    from (
      select
        c.code,
        (b.encounter_date >= now() - interval '14 days') as recent
      from base b
      cross join lateral (
        select jsonb_array_elements_text(b.symptom_icd_codes) as code
        union all
        select b.primary_icd_10
      ) c
      where c.code is not null and c.code <> ''
        and b.encounter_date >= now() - interval '42 days'
    ) x group by code
  ),
  ages as (
    select
      coalesce(age_bracket, 'unknown') as age_bracket,
      count(*) filter (where encounter_date >= now() - interval '14 days') as recent,
      count(*) filter (where encounter_date >= now() - interval '14 days'
                         and is_focus) as recent_focus,
      count(*) filter (where encounter_date >= now() - interval '28 days'
                         and encounter_date < now() - interval '14 days') as prior
    from base group by 1
  ),
  weekly as (
    select
      (date_trunc('week', encounter_date))::date as w,
      count(*) as total,
      count(*) filter (where is_focus) as focus,
      count(*) filter (where urgency_level = 'HIGH_RED_FLAG') as red_flag,
      count(*) filter (where disposition = 'ER_REFERRAL') as er
    from base group by 1 order by 1
  )
  select jsonb_build_object(
    'since', _since,
    'generatedAt', now(),
    'focusPrefixes', to_jsonb(_f),
    'total', (select count(*) from base),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by d) from daily), '[]'::jsonb),
    'weekly', coalesce((select jsonb_agg(to_jsonb(weekly) order by w) from weekly), '[]'::jsonb),
    'postal', coalesce((select jsonb_agg(to_jsonb(p)) from (
        select * from postal where recent > 0 order by recent desc limit 20) p), '[]'::jsonb),
    'codes', coalesce((select jsonb_agg(to_jsonb(c)) from (
        select * from codes order by recent desc limit 25) c), '[]'::jsonb),
    'ages', coalesce((select jsonb_agg(to_jsonb(a) order by a.age_bracket) from ages a), '[]'::jsonb)
  ) into _res;

  return _res;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.outbreak_stats(integer, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.outbreak_stats(integer, text[]) TO authenticated;