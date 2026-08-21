# Synthea COVID-19 import + outbreak intelligence

## What's in the dataset

12,352 synthetic Massachusetts patients, 8,820 COVID-19 cases. It does contain doctors: `providers.csv` has named practitioners with a speciality (GENERAL PRACTICE, EMERGENCY MEDICINE, INFECTIOUS DISEASE, …), an organization and an address, and every encounter points at one provider + one organization.

Field coverage against our tables:

| Our table | Source | Gaps and how they're filled |
|---|---|---|
| `patient` | patients.csv | DOB, sex, race/ethnicity, marital, ZIP present. No CPR/phone/language/industry/insurance → generated deterministically (CPR from DOB + sequence, language `da`, insurance defaults) |
| `practitioner` | providers.csv | Name, speciality, org present. No license number → generated; role mapped DOCTOR/NURSE from speciality |
| `organization` | organizations.csv | Direct map, type inferred from name (HOSPITAL / GP_CLINIC / SPECIALIST) |
| `visit` | encounters.csv | Date, class, reason present. Urgency + disposition derived from encounter class and reason codes; symptoms text built from the encounter's conditions |
| `clinical_record` | conditions.csv | SNOMED codes — stored as-is with `code_system = SNOMED`, plus an ICD-10 mapping for the common respiratory/COVID set |
| `observation` | observations.csv | LOINC — direct fit, straight into `loinc_code` / `value` / `unit` |
| `drug_prescription` | medications.csv | RxNorm, not ATC — drug name kept, `atc_code` filled only where a mapping table covers it |
| `anonymized_encounter` | encounters + conditions + observations | Fully derivable; no names, no CPR, age bracketed, ZIP kept as postal code |

## Date shift

The COVID curve starts 2020-01-20 with 1 case/day and reaches ~100/day by late February. We take the **early ramp**: 2020-01-20 → 2020-03-05, and shift it so 2020-03-05 lands on today. That puts roughly 1.5k COVID cases across the last ~6 weeks, ending mid-exponential — visibly climbing but not yet obvious, which is the point of the detection demo. Every date (encounters, conditions, observations, medications) shifts by the same constant offset, so intervals stay intact.

## Scope

### 1. Import (~20k encounters)

Existing patients (Jane Smith, Elena Petrova, …), their visits and users all stay untouched.

- **Surveillance layer**: ~20,000 `anonymized_encounter` rows covering the whole shifted window — the population signal the dashboard reads.
- **Clinical slice**: ~120 full patients with their practitioners, organizations, visits, conditions, observations and prescriptions, so the clinical console, patient registry and passport views are populated with realistic COVID-era cases. The slice is picked to include a spread of COVID and non-COVID presentations, plus severe cases (ICU/ventilator) for triage testing.
- No auth users are created for imported patients; they are registry records the practitioner side works with. A handful of the imported doctors get login accounts so the clinical views can be exercised.
- Import runs as batched inserts with a source-id tag so it is re-runnable and removable.

### 2. Outbreak intelligence

A new **Outbreak** section on the surveillance dashboard:

- **Epidemic curve** — daily case counts per syndrome group with a 7-day moving average.
- **Growth signal** — week-over-week growth rate and estimated doubling time per postal area, flagged when growth crosses a threshold.
- **Geographic spread** — postal-area heat table ranked by case rate and by growth, not just raw count.
- **Syndromic clustering** — grouping of encounters by symptom-code pattern using the embeddings already on `anonymized_encounter`, surfacing clusters that are growing faster than baseline.
- **Age/severity shift** — tracks whether the mix of urgency and disposition is deteriorating (rising ER referrals is an earlier signal than raw case count).
- **Anomaly panel** — a ranked list of "this looks wrong" findings: postal areas above expected volume, unusual symptom combinations, sudden severity shifts.

### 3. Epidemiologist agent

A new agent, `outbreak-analyst`, added to the existing agent registry and available as a chat drawer on the surveillance page. It receives the computed statistics (never raw patient rows) and can:

- explain what the current signals mean in plain language
- answer follow-up questions about a specific postal area, age group or syndrome
- propose concrete responses — testing capacity, staffing, isolation guidance, which clinics are about to be overwhelmed
- draft a situation report the analyst can copy out

Alarming findings are surfaced as cards on the dashboard with a "Discuss with analyst" action that opens the agent pre-loaded with that finding.

## Technical notes

- Import runs as a one-off server-side script against the database in batches; the zip is read from the upload mount and not committed to the repo.
- Date shift is a single constant offset applied at read time during import, computed as `today − 2020-03-05`.
- Deterministic CPR generation keeps the format the app already validates, with a marker digit range that will not collide with the existing hand-made test patients.
- Statistics are computed in a server function over `anonymized_encounter` only, so the analyst role never touches identifiable data.
- Clustering reuses the existing `clinical_embedding` column (`corti-s1-embedding`, 2560-dim); imported rows get embeddings generated in batches, with a code-pattern fallback if embedding generation is rate-limited.
- The agent follows the existing Corti agent pattern in the registry, with the same drawer-based chat UI used elsewhere.

## Build order

1. Import script: organizations → practitioners → patients → visits → clinical data
2. Anonymized encounter generation + embeddings
3. Outbreak analytics server function (curve, growth, geography, severity)
4. Outbreak dashboard section with charts and anomaly cards
5. `outbreak-analyst` agent + chat drawer wired to the findings
