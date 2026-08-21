ALTER TABLE public.anonymized_encounter DROP COLUMN IF EXISTS gender;

DROP INDEX IF EXISTS anonymized_encounter_clinical_embedding_idx;

ALTER TABLE public.anonymized_encounter
  ALTER COLUMN clinical_embedding TYPE vector(2560) USING NULL;

CREATE INDEX anonymized_encounter_clinical_embedding_idx
  ON public.anonymized_encounter
  USING hnsw ((clinical_embedding::halfvec(2560)) halfvec_cosine_ops);