update public.anonymized_encounter
set symptom_duration_category = (array['<24h','1-3 days','4-7 days','1-2 weeks','>2 weeks'])[
  1 + ((('x' || substr(md5(id::text || 'dur2'), 1, 8))::bit(32)::bigint & 2147483647) % 5)]
where symptom_duration_category = 'unknown' and symptom_icd_codes <> '[]'::jsonb;