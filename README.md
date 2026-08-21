# Ante

Ante is a clinical intelligence platform that pairs a **patient clinical passport** with **real-time epidemiological surveillance**.

It covers the full primary-care loop:

- **Patients** keep a portable passport (conditions, allergies, prescriptions, observations, visit history), run an AI pre-visit intake by voice or chat, see live queue position with an estimated wait, and receive a plain-language handout after every consultation.
- **Clinicians** manage a triaged waiting room, register physical arrivals with CPR lookup and consent, run ambient-recorded consultations with speaker diarization and automatic clinical fact extraction, then review and sign off structured notes, prescriptions, lab orders and follow-ups.
- **Public-health analysts** query a de-identified encounter log through an autonomous epidemiologist agent that writes its own SQL and renders a dashboard of charts, metrics and outbreak alerts.

Every signed-off visit is de-identified (demographic brackets, ICD-10/ATC/LOINC codes, postal code, weather, clinical embedding) into a population-level surveillance table — no names, no CPR, no free text.

---

## Capability checklist

| Capability | Done | Where | How |
| --- | --- | --- | --- |
| Ambient speech-to-text | ✅ | `src/hooks/use-corti-stream.ts`, `src/components/ante/consultation-recorder.tsx`, `createStreamInteraction` in `src/lib/corti.server.ts` | Consultation audio is streamed to Corti `/streams` over WebSocket during the visit; transcript arrives live with speaker diarization (speaker IDs mapped to Doctor / Patient / Speaker N) and FactsR clinical facts, autosaved to `visit.visit_transcript` every 8s. |
| Dictation speech-to-text | ✅ | `src/hooks/use-corti-dictation.ts`, `src/components/ante/voice-intake-modal.tsx`, `transcribeAudio` / `uploadRecording` in `src/lib/corti.server.ts` | Hold-to-talk capture in the patient intake drawer; audio is uploaded to a Corti interaction and transcribed via the Corti transcription endpoint, returning text into the intake chat. |
| Text generation | ✅ | `cortiChat` in `src/lib/corti.server.ts`, used by `src/lib/handout.server.ts`, `src/lib/consultation.functions.ts`, `src/lib/transcript-reprocess.server.ts`, `src/lib/analytics-agent.server.ts` | `corti-s1` generates the structured clinical note from transcript + extracted facts, the plain-language patient handout (markdown, printable), reconciliation summaries on transcript reprocessing, and surveillance narratives. |
| Agentic framework | ✅ | `src/lib/agents/registry.ts`, `src/lib/corti-agents.server.ts`, `src/routes/api/intake.ts`, `src/lib/followup.server.ts`, `src/lib/analytics-agent.server.ts` | Corti Agentic v2 agents with per-agent system prompts and context packs: intake, intake-edit, queue triage, charge nurse (wait estimation), care navigator, follow-up planner, outbreak analyst, and a tool-calling surveillance epidemiologist that writes its own read-only SQL and emits a dashboard spec. |
| Medical coding | ✅ | `predictCodes` in `src/lib/corti.server.ts`, `src/routes/api/intake.ts`, `src/lib/anonymized-encounter.server.ts` | Corti `/tools/coding/` maps intake complaints and consultation findings to ICD-10 / ATC / LOINC / SKS codes; the primary ICD-10 code plus code sets are stored on the de-identified `anonymized_encounter` row and drive syndromic surveillance grouping. |

---


## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start (React 19, TanStack Router + Query, Vite 7) |
| Styling | Tailwind CSS v4, shadcn/ui, Framer Motion, Recharts |
| Backend | Postgres (Supabase) with row-level security, server functions, server routes |
| AI | Corti Agentic v2 (`corti-s1`), Corti STT / ambient streams, `corti-s1-embedding` (2560-dim, pgvector) |
| Data | ICD-10, ATC, LOINC, SKS coding; Open-Meteo weather enrichment |

---

## Application routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/` | public | Landing page |
| `/auth` | public | Sign-in, Google OAuth, multi-step onboarding with license verification |
| `/passport` | patient | Clinical passport, live queue status, care navigator, AI intake |
| `/visits` | patient | Filterable visit history with detail drawer and patient summaries |
| `/clinical` | clinician | Triaged patient queue, search/filters, register a physical arrival |
| `/consultation/$visitId` | clinician | Consultation workspace: passport, intake, ambient recorder, sign-off |
| `/patients` | clinician | Patient registry with side-by-side passport and editable clinical tables |
| `/surveillance` | analyst | Agent-generated outbreak dashboard and epidemiology chat |
| `/settings` | all | Profile, demographics, insurance and contact details |

---

## AI agents

All agents are defined in `src/lib/agents/registry.ts` and run on Corti Agentic v2.

| Agent | Name | Role |
| --- | --- | --- |
| Intake | `ante-intake-agent-v3` | Conducts the pre-visit HPI interview with the patient and codes symptoms |
| Intake edit | `ante-intake-edit-agent-v2` | Lets a patient revise an existing scheduled intake, with prior transcript context |
| Charge nurse | `ante-charge-nurse-agent-v1` | Estimates consultation duration and patient wait times |
| Queue triage | `ante-queue-triage-agent-v1` | Ranks the waiting room by urgency plus waiting time |
| Care navigator | `ante-care-navigator-agent-v1` | Recommends which practitioner a patient should see |
| Follow-up planner | `ante-follow-up-planner-agent-v1` | Turns a signed-off plan into prefilled scheduled follow-up intakes |
| Outbreak analyst | `ante-outbreak-analyst-agent-v1` | Interprets precomputed surveillance signals for analysts |
| Surveillance intelligence | `ante-surveillance-intelligence-agent-v1` | Tool-calling epidemiologist that runs read-only SQL and emits the dashboard spec |

Supporting AI pipelines: ambient transcript → clinical fact extraction (Corti FactsR) → note drafting → structured observations/prescriptions/records → patient handout → de-identified encounter + embedding.

---

## HTTP endpoints (`src/routes/api/`)

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/intake` | POST | Streaming intake agent turn, urgency/code extraction, visit creation |
| `/api/transcribe` | POST | Batch speech-to-text for recorded audio |
| `/api/stt-session` | POST | Mints a short-lived Corti STT session for hold-to-talk dictation |
| `/api/stream-session` | POST | Mints an ambient consultation stream (diarization + live facts) |
| `/api/verify-doctor` | POST | Mock Danish practitioner license registry verification |

---

## Server functions (`createServerFn`)

**Context & passport** — `getMyContext`, `getPassport`, `getMySettings`, `updateMySettings`, `getMyVisitHistory`, `getVisitDetail`, `updateVisitSymptoms`

**Intake** — `createPreIntakeVisit`, `updatePreIntakeVisit`, `deleteScheduledVisit`, `sendAgentTurn`

**Queue & clinic** — `getClinicalQueue`, `prioritizeQueue`, `saveQueueOrder`, `getMyQueueStatus`, `markVisitTakenIn`, `registerVisitArrival`, `findScheduledVisitsByCpr`, `finaliseVisit`

**Consultation** — `extractConsultationFacts`, `saveVisitTranscript`, `reprocessVisitTranscript`, `draftConsultation`, `signOffConsultation`, `generatePatientHandout`, `planVisitFollowUps`, `recordAnonymizedVisit`

**Clinical records** — `getVisitClinicalItems`, `saveVisitObservation`, `saveVisitPrescription`, `saveVisitRecord`, `deleteVisitClinicalItem`, `getPatientRecord`

**Registry & consent** — `getMyPatients`, `removePatientFromRegistry`, `getMyCareTeam`, `addCareTeamMember`, `removeCareTeamMember`, `requestPatientConsent`, `forceRequestPatientConsent`, `getMyConsentRequests`, `respondToConsent`

**Navigation** — `recommendCareForVisit`, `searchPractitioners`, `getPractitionerWaitingRoom`

**Surveillance** — `getSurveillance`, `getOutbreakIntelligence`, `askOutbreakAnalyst`, `analyzeSurveillance`, `listAnalyticsCards`, `saveAnalyticsCard`, `deleteAnalyticsCard`

**Onboarding** — `verifyPractitioner`, `completeOnboarding`

---

## External services

| Service | Endpoint | Used for |
| --- | --- | --- |
| Corti API | `https://api.eu.corti.app/v2` | Interactions, transcripts, facts, chat completions, embeddings |
| Corti Auth | `https://auth.eu.corti.app/realms/base/protocol/openid-connect/token` | OAuth client-credentials token |
| Corti audio bridge | `wss://api.eu.corti.app/audio-bridge/v2/interactions/{id}/streams` | Live ambient transcription with speaker diarization |
| Open-Meteo | `api.open-meteo.com`, `archive-api.open-meteo.com` | Weather conditions per encounter (forecast + historical archive) |
| Zippopotam | `api.zippopotam.us/dk/{postcode}` | Danish postal code → coordinates |

---

## Database (Postgres + RLS)

Core tables: `patient`, `practitioner`, `organization`, `profiles`, `user_roles`, `visit`, `clinical_record`, `visit_clinical_record`, `observation`, `drug_prescription`, `patient_care_team`, `patient_proxy`, `consent_grant`, `queue_priority`, `anonymized_encounter`, `analytics_card`, `analytics_session`, `icd10_code_lookup`, `industry_lookup`.

Key database functions: `has_role`, `can_read_patient`, `has_consent`, `current_patient_id`, `current_practitioner_id`, `request_consent_by_cpr`, `break_glass_by_cpr`, `apply_onboarding`, `owns_visit`, `outbreak_stats`, `analytics_query` (read-only SQL guard for the surveillance agent).

Roles: `PATIENT`, `PRACTITIONER`, `ANALYST` — stored in `user_roles`, never on the profile.

---

## Development

Requires Node.js 20+.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

Environment variables (server-side only unless prefixed `VITE_`):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
CORTI_CLIENT_ID
CORTI_CLIENT_SECRET
```
