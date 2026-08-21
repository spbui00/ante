# Fold the anonymized dual-write into sign-off

Option B: delete the unused `/api/process-visit` endpoint and generate the de-identified population row at the moment a clinician signs off a consultation.

## What changes

1. **Delete** `src/routes/api/process-visit.ts` (nothing in the app calls it).
2. **Sign-off writes the population row.** After `signOffConsultation` saves diagnoses, prescriptions and observations, it also builds one de-identified `anonymized_encounter` row from the visit + patient record and inserts it. Like the patient handout, this runs without blocking the clinician.
3. **Drop `gender`** from `anonymized_encounter` (stale — `sex` and `gender_identity` already cover it).
4. **Corti model upgrade**: `cortiChat` default model moves from `corti-s1-mini` to `corti-s1`.
5. **Real embeddings**: new `embedText()` helper calling Corti's `corti-s1-embedding` model, used to fill `clinical_embedding` on the new row.

## What goes into the embedding

Excluded, as requested: names, CPR numbers, exact dates of birth. Also excluded: postal code at full precision, practitioner name, and any free-text transcript (transcripts are the single biggest re-identification risk — they contain names, workplaces, relatives).

Included — a compact, structured clinical sentence built from already-de-identified fields:

- Age in years bucketed as written (`52yo male`), sex, pregnancy status if true
- Encounter type, urgency level, disposition
- Symptom summary (the AI-written `symptoms` field, PII-scrubbed), plus symptom duration category
- Diagnoses: text + ICD-10 codes (primary first, then secondary)
- Relevant clinical history codes
- Observations: test name, LOINC code, value + unit (numbers carry real signal for outbreak detection)
- Prescriptions: drug name + ATC code
- Conclusion and recommendation text (clinician-written, no identifiers)
- Coarse context: month + year, day of week, first 2 digits of postal code (region, not street), industry

Rationale: for epidemiological similarity search you want *what happened clinically*, not narrative. Codes give precision, the summary/conclusion text gives nuance the codes miss, and the coarse demographic/temporal context lets clusters group by region and season without identifying anyone.

## Technical notes

- `clinical_embedding` is currently `vector(1536)`. `corti-s1-embedding`'s output dimension will be confirmed with a live call before wiring; if it differs, the column is resized in the same migration and the HNSW index recreated (halfvec cast if over 2000 dims).
- The embedding input is assembled in a server-only helper (`src/lib/anonymized-encounter.server.ts`) so the de-identification rules live in one place.
- Insert uses the service-role client inside the handler, since `anonymized_encounter` has no per-user policy path.
- If the Corti embedding call fails, the row is still inserted with a null embedding and the failure is logged — sign-off never fails because of it.
- One migration: `ALTER TABLE public.anonymized_encounter DROP COLUMN gender;` plus any vector resize.
