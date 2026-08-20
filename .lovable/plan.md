# Ante — Clinical Passport & Epidemiological Intelligence Platform

## One framework note first

This project runs on TanStack Start (React 19 + Vite), which is fixed and cannot be swapped for Next.js. Everything you asked for maps over cleanly:

- `app/api/...` route handlers → TanStack server routes (`src/routes/api/...`) and server functions
- Next.js App Router pages → file-based routes in `src/routes`
- Supabase client/server components → Supabase browser client + authenticated server functions

Tailwind CSS, shadcn/ui, Lucide, Recharts, Supabase and TypeScript are all exactly as requested. Tailwind v4 here is configured in `src/styles.css` (no `tailwind.config.js`), so the palette lands there as theme tokens.

## Scope

### 1. Backend (Lovable Cloud / Postgres)

Enable Lovable Cloud, then one migration that creates:

- Extensions: `uuid-ossp`, `vector`
- Enums: `urgency_enum`, `visit_status_enum`, `encounter_type_enum`, `disposition_enum`, `consent_status_enum`, `record_category_enum`, `record_status_enum`, plus org/practitioner/proxy/code-system enums
- Tables from the ERD: `organization`, `practitioner`, `patient`, `patient_proxy`, `consent_grant`, `visit`, `clinical_record`, `visit_clinical_record`, `drug_prescription`, `observation`, `anonymized_encounter` (with `vector(1536)` embedding), `icd10_code_lookup`, `industry_lookup`
- PKs, FKs, unique constraints, `uuid_generate_v4()` / `CURRENT_TIMESTAMP` defaults, JSONB defaults
- `app_role` enum (`PATIENT`, `PRACTITIONER`, `ANALYST`) in a separate `user_roles` table with a `has_role()` security-definer function — roles never live on the profile row
- GRANTs + RLS on every table: patients read/write their own rows; practitioners reach patient data only through an ACTIVE `consent_grant` (or emergency override); analysts read `anonymized_encounter` only. No identifiable table is readable by `anon`.
- Seed data: lookups (industries, ICD-10 chapter codes) and demo patients/visits/anonymized encounters derived from the sample clinical dataset already in the repo, so every screen renders populated on first load.

Generated DB types are provided by the integration; a `src/types/database.ts` layer re-exports friendly model aliases.

### 2. Auth & role routing

- `/auth` — public email/password sign-in and sign-up, role chosen at sign-up for the demo
- Protected subtree with a role-aware landing redirect:
  - PATIENT → `/passport`
  - PRACTITIONER → `/clinical`
  - ANALYST → `/surveillance`
- Users hitting a screen outside their role get redirected to their own home.

### 3. Screens

**`/passport` (mobile-first)** — patient identity header, active medications, conditions/allergies, observation history, visit timeline, and a Voice Intake modal with a pulsing mic button that captures audio/text and posts to a mock intake endpoint returning a structured pre-intake summary.

**`/clinical` (tablet/desktop)** — patient queue with urgency badges and consent state, consultation view showing AI visit summary (Symptoms / Conclusion / Recommendation), extracted ICD-10/SKS codes, LOINC observations, ATC prescription picker, a live-audio streaming placeholder, and disposition selection. Break-glass emergency access with mandatory justification, written to `consent_grant`.

**`/surveillance` (desktop)** — multi-column command center: symptom spikes by postal code, time-series trend lines, urgency/disposition breakdowns (Recharts), and a filterable table querying `anonymized_encounter` only. Filters: date range, postal code, age bracket, ICD chapter.

**`/` (index)** — Ante landing page with product framing and a sign-in CTA.

### 4. Server logic

- `POST /api/process-visit` — accepts transcript data, includes clear `// TODO:` markers for Corti Medical Coding + Text Gen calls, and performs the dual write: identifiable row into `visit`, de-identified/vectorized row into `anonymized_encounter` (age bracketed, CPR/name never copied).
- `POST /api/intake` — mock Corti Agentic pre-intake, returns symptoms + R-codes + urgency.
- Authenticated reads/writes for passport, clinical and surveillance data go through server functions with RLS applied as the signed-in user.

### 5. Design system

Black/white base for maximum contrast, with your palette registered as theme tokens in `src/styles.css` and mapped to semantic roles:

- `jet_black` — dark surfaces, heavy borders, dark mode base
- `blue_slate` / `cool_steel` — secondary text, borders, muted UI
- `light_cyan` / `light_blue` — primary actions, active states, highlights, chart accents

All components use semantic tokens, never hardcoded colors. Charts use a palette derived from the same tokens.

## Technical details

- Routes: `src/routes/index.tsx`, `auth.tsx`, `_authenticated/passport.tsx`, `_authenticated/clinical.tsx`, `_authenticated/clinical.$visitId.tsx`, `_authenticated/surveillance.tsx`, `api/process-visit.ts`, `api/intake.ts`
- Data fetching: route loaders + `ensureQueryData` with `useSuspenseQuery` in components
- Server fns in `src/lib/*.functions.ts`; privileged helpers in `*.server.ts`
- Voice capture uses the browser MediaRecorder API behind a client-only boundary; no external speech vendor is wired up yet — the Corti call sites are stubbed with TODOs as requested
- Deployment target here is Lovable's hosting rather than Vercel; the code stays portable

## Build order

1. Cloud + migration + seed
2. Auth, roles, protected routing, design tokens
3. `/passport` + intake modal + `/api/intake`
4. `/clinical` + `/api/process-visit` dual write
5. `/surveillance` charts and table
6. Landing page, SEO metadata, security review
