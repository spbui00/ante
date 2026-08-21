# Agent-generated surveillance dashboard

Replace the hardcoded COVID/respiratory cards on Surveillance with a dashboard that a senior epidemiologist agent builds itself from the whole de-identified encounter log — and let the user pin any card it produces so it comes back next time without re-analysis.

## What the user sees

1. **Analyze button + window picker** at the top of Surveillance (default: last 60 days). Pressing it runs the analyst agent over the full anonymized encounter log — no preset condition filter.
2. **Agent output** renders as real UI: a headline assessment, alert cards (critical / warning / info), metric cards, and charts (line, area, bar) plus tables — all generated from data the agent actually queried.
3. **Pin** on every card. Pinned cards are stored and re-rendered instantly on the next visit by re-running their saved query — the agent is not called again.
4. **Chat** with the same analyst about what it found; asking it to "add a card for X" or "redo this for 6 months" regenerates or appends cards live.
5. The agent knows **who is asking** (patient / practitioner / analyst) and adapts tone and depth: plain-language public advice for a patient, clinical/capacity framing for a practitioner, full epidemiological detail for an analyst.

The old fixed focus-picker panel and its hardcoded COVID/respiratory/GI cards are removed.

## Data access for the agent

The agent runs a small tool loop on the server (max ~6 steps): it asks for aggregations, gets results back, then decides what cards to emit.

Tools:
- `run_query` — read-only aggregate SQL against the de-identified encounter data only.
- `list_dimensions` — available columns, enum values, date range, row count, top ICD-10 codes/chapters.

Safety: queries go through a new `analytics_query(_sql text)` database function that only accepts a single `SELECT`/`WITH` statement against a de-identified surveillance view, blocks DML/DDL, caps rows and sets a statement timeout. The view exposes only `anonymized_encounter` columns (no identifiers, no embeddings).

## Card storage

New table `analytics_card`:

| column | purpose |
| --- | --- |
| `id`, `owner_id`, `created_at`, `updated_at` | ownership (pins are per user) |
| `title`, `subtitle` | card header |
| `kind` | `metric` / `alert` / `line` / `area` / `bar` / `table` |
| `sql_query` | the query that produces the card's rows |
| `config` | jsonb: axis keys, series + labels, colour token, number format, severity, thresholds |
| `window_days` | window the card was designed for |
| `position`, `pinned` | ordering and pin state |

RLS: a user reads/writes only their own cards; grants for `authenticated`, plus `service_role`.

On load, pinned cards are re-executed through `analytics_query` with the saved SQL, so the numbers are always current while the layout stays fixed.

## Technical notes

- New agent `outbreak-intelligence` in `src/lib/agents/registry.ts`: senior field epidemiologist prompt, `memory` registry connector, tool-loop protocol, and a strict JSON contract for emitted cards (`{"cards":[...], "narrative":"..."}`). Corti agents run on `corti-s1` by default; no model field is exposed on agent creation.
- New `src/lib/analytics.functions.ts`: `analyzeSurveillance` (runs the tool loop, returns cards + narrative), `runAnalyticsCard` (executes one saved card), `saveAnalyticsCard` / `deleteAnalyticsCard` / `listAnalyticsCards`. All `requireSupabaseAuth`; the caller's role is resolved server-side and included in the agent briefing.
- New `src/lib/analytics-agent.server.ts`: tool loop, SQL guardrails, card-spec validation with zod (unknown kinds and malformed configs are dropped, never rendered blindly).
- New `src/components/ante/analytics-card.tsx`: generic renderer mapping a card spec + rows to Recharts/Table/metric UI, with pin and remove controls.
- `outbreak-panel.tsx` is replaced by `intelligence-panel.tsx`; the chat drawer is reused and extended so replies can carry new cards. Drawer stays the modal component per project convention.
- Deletions: `src/lib/outbreak-focus.ts`, the focus plumbing in `outbreak.functions.ts` / `outbreak.server.ts`, and the `outbreak_stats` SQL function once nothing calls it.

## Sequence

1. Migration: surveillance view, `analytics_query`, `analytics_card` table + RLS + grants.
2. Agent registry entry + tool loop server module.
3. Server functions.
4. Generic card renderer + new panel; wire pinning.
5. Chat drawer extended to append/regenerate cards; role-aware briefing.
6. Remove the old focus panel and dead SQL.
