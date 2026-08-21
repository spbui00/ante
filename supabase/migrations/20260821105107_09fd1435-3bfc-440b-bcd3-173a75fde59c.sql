create or replace function public._ae_h(_id uuid, _salt text)
returns bigint language sql immutable as $$
  select (('x' || substr(md5(_id::text || _salt), 1, 8))::bit(32)::bigint) & 2147483647;
$$;

update public.anonymized_encounter set industry = case
  when age_bracket in ('0-9','10-19') then 'Student'
  when age_bracket in ('70-79','80+') then 'Retired'
  else (array['Healthcare','Education','Construction','Transport','Hospitality',
              'Information Technology','Agriculture','Retail','Manufacturing',
              'Public Administration','Unemployed'])[1 + (public._ae_h(id,'ind') % 11)]
end
where industry is null;

update public.anonymized_encounter set gender_identity = case
  when public._ae_h(id,'gi') % 100 < 2 then 'NON_BINARY'::gender_identity_enum
  when public._ae_h(id,'gi') % 100 < 3 then 'PREFER_NOT_TO_SAY'::gender_identity_enum
  when sex = 'MALE' then 'MAN'::gender_identity_enum
  when sex = 'FEMALE' then 'WOMAN'::gender_identity_enum
  else 'OTHER'::gender_identity_enum
end
where gender_identity is null;

update public.anonymized_encounter set primary_icd_10 = case
  when disposition = 'ER_REFERRAL' then
    (array['A41.9','J18.9','I50.9','K35.80','N17.9','S06.0','I63.9','R57.1'])[1 + (public._ae_h(id,'dx') % 8)]
  when disposition = 'PRESCRIPTION' then
    (array['J06.9','N39.0','L03.90','K21.9','I10','E11.9','M54.5','B34.9','H66.9','J01.90'])[1 + (public._ae_h(id,'dx') % 10)]
  else
    (array['Z00.00','Z76.0','M54.5','R51','R10.4','F41.9','J06.9','L30.9','R42','E78.5','M79.1','R53.83'])[1 + (public._ae_h(id,'dx') % 12)]
end
where primary_icd_10 is null;

update public.anonymized_encounter set symptom_icd_codes = case
  when primary_icd_10 like 'J%' or primary_icd_10 like 'U07%' then '["R05.9","R50.9","R06.02"]'::jsonb
  when primary_icd_10 like 'A%' or primary_icd_10 like 'B%' then '["R50.9","R53.83"]'::jsonb
  when primary_icd_10 like 'K%' then '["R10.4","R11.0"]'::jsonb
  when primary_icd_10 like 'I%' then '["R07.9","R06.02"]'::jsonb
  when primary_icd_10 like 'N%' then '["R30.0","R10.2"]'::jsonb
  when primary_icd_10 like 'M%' then '["M79.1","R53.1"]'::jsonb
  when primary_icd_10 like 'F%' then '["R45.0","R51"]'::jsonb
  when primary_icd_10 like 'L%' then '["R21","R60.0"]'::jsonb
  when primary_icd_10 like 'Z%' then '[]'::jsonb
  else '["R53.83"]'::jsonb
end
where symptom_icd_codes = '[]'::jsonb;

update public.anonymized_encounter set symptom_duration_category =
  (array['<24h','1-3d','4-7d','1-2w','>2w'])[1 + (public._ae_h(id,'dur') % 5)]
where symptom_duration_category is null and symptom_icd_codes <> '[]'::jsonb;

update public.anonymized_encounter set clinical_history_icd_codes = (
  case when age_bracket in ('0-9','10-19') then
    case when public._ae_h(id,'hx') % 10 < 8 then '[]'::jsonb else '["J45.909"]'::jsonb end
  when age_bracket in ('20-29','30-39','40-49') then
    (array['[]'::jsonb,'[]'::jsonb,'["I10"]'::jsonb,'["J45.909"]'::jsonb,'["E66.9"]'::jsonb,'["F41.9"]'::jsonb])[1 + (public._ae_h(id,'hx') % 6)]
  else
    (array['["I10"]'::jsonb,'["I10","E11.9"]'::jsonb,'["E11.9"]'::jsonb,'["I10","E78.5"]'::jsonb,
           '["J44.9"]'::jsonb,'["I10","N18.3"]'::jsonb,'[]'::jsonb,'["I48.91","I10"]'::jsonb])[1 + (public._ae_h(id,'hx') % 8)]
  end)
where clinical_history_icd_codes = '[]'::jsonb;

update public.anonymized_encounter set secondary_icd_10_codes = clinical_history_icd_codes
where secondary_icd_10_codes = '[]'::jsonb
  and clinical_history_icd_codes <> '[]'::jsonb
  and public._ae_h(id,'sec') % 10 < 4;

update public.anonymized_encounter set prescription_atc_codes = case
  when primary_icd_10 like 'J01%' or primary_icd_10 like 'J18%' or primary_icd_10 = 'A41.9' then '["J01CA04"]'::jsonb
  when primary_icd_10 like 'U07%' then '["N02BE01"]'::jsonb
  when primary_icd_10 like 'J4%' then '["R03AC02","R03BA02"]'::jsonb
  when primary_icd_10 like 'J%' then '["N02BE01","R05CB01"]'::jsonb
  when primary_icd_10 = 'N39.0' then '["J01XE01"]'::jsonb
  when primary_icd_10 like 'L03%' then '["J01CR02"]'::jsonb
  when primary_icd_10 = 'K21.9' then '["A02BC01"]'::jsonb
  when primary_icd_10 = 'I10' then '["C09AA05"]'::jsonb
  when primary_icd_10 = 'E11.9' then '["A10BA02"]'::jsonb
  when primary_icd_10 = 'M54.5' then '["M01AE01"]'::jsonb
  when primary_icd_10 = 'F41.9' then '["N06AB03"]'::jsonb
  when primary_icd_10 = 'H66.9' then '["J01CA04"]'::jsonb
  when primary_icd_10 = 'E78.5' then '["C10AA01"]'::jsonb
  else '["N02BE01"]'::jsonb
end
where prescription_atc_codes = '[]'::jsonb
  and (disposition = 'PRESCRIPTION' or public._ae_h(id,'rx') % 10 < 3);

update public.anonymized_encounter set travel_history =
  (array['["DE"]'::jsonb,'["SE"]'::jsonb,'["ES"]'::jsonb,'["GB"]'::jsonb,'["TR"]'::jsonb,
         '["TH"]'::jsonb,'["US"]'::jsonb,'["IT"]'::jsonb,'["FR"]'::jsonb,'["PL"]'::jsonb])[1 + (public._ae_h(id,'tv') % 10)]
where travel_history = '[]'::jsonb and public._ae_h(id,'tv2') % 100 < 7;

with w as (
  select id,
    round(((array[1.5,1.6,3.6,7.6,12.2,15.3,17.6,17.4,14.0,9.8,5.6,2.6])[extract(month from encounter_date)::int]
      + ((public._ae_h(id,'t') % 61) - 30) / 10.0)::numeric, 1) as tmean,
    (public._ae_h(id,'p') % 100) as praw,
    60 + (public._ae_h(id,'h') % 33) as hum,
    8 + (public._ae_h(id,'w') % 38) as wind,
    to_char(encounter_date, 'YYYY-MM-DD') as d
  from public.anonymized_encounter
  where weather_conditions = '{}'::jsonb or weather_conditions is null
), w2 as (
  select *, case when praw < 45 then 0.0 else round(((praw % 80) / 10.0)::numeric, 1) end as precip from w
)
update public.anonymized_encounter ae
set weather_conditions = jsonb_build_object(
  'source', 'synthetic-seasonal-dk',
  'date', w2.d,
  'temperature_mean_c', w2.tmean,
  'temperature_min_c', round((w2.tmean - 3.2)::numeric, 1),
  'temperature_max_c', round((w2.tmean + 4.1)::numeric, 1),
  'precipitation_mm', w2.precip,
  'humidity_mean_pct', w2.hum,
  'wind_max_kmh', w2.wind,
  'summary', concat(
    case when w2.tmean < 2 then 'freezing' when w2.tmean < 8 then 'cold'
         when w2.tmean < 15 then 'cool' when w2.tmean < 22 then 'mild' else 'warm' end,
    ' (', w2.tmean, '°C mean), ',
    case when w2.precip = 0 then 'dry' when w2.precip < 3 then 'light precipitation'
         when w2.precip < 8 then 'moderate precipitation' else 'heavy precipitation' end,
    ' (', w2.precip, ' mm), ', w2.hum, '% humidity, wind to ', w2.wind, ' km/h')
)
from w2 where w2.id = ae.id;

drop function public._ae_h(uuid, text);