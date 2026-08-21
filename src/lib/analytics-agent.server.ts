/**
 * Surveillance intelligence agent runtime — server only.
 *
 * Runs a small tool loop against the de-identified surveillance view: the agent
 * asks for aggregations (`run_query`), we execute them through the read-only
 * `analytics_query` SQL helper (RLS applies as the calling user), and the agent
 * finally emits a dashboard specification we render generically.
 */

import { z } from "zod";

import { getAgentDefinition } from "@/lib/agents/registry";
import { sendAgentMessage } from "@/lib/agents/corti-agents.server";

export const CARD_KINDS = ["metric", "alert", "line", "area", "bar", "table"] as const;

export const cardSpecSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(240).nullish(),
  kind: z.enum(CARD_KINDS),
  sql: z.string().max(4000).nullish(),
  config: z
    .object({
      xKey: z.string().max(60).nullish(),
      valueKey: z.string().max(60).nullish(),
      unit: z.string().max(20).nullish(),
      severity: z.enum(["critical", "warning", "info"]).nullish(),
      text: z.string().max(1200).nullish(),
      series: z
        .array(
          z.object({
            key: z.string().max(60),
            label: z.string().max(80).nullish(),
            color: z.string().max(40).nullish(),
          }),
        )
        .max(6)
        .nullish(),
      columns: z
        .array(z.object({ key: z.string().max(60), label: z.string().max(80).nullish() }))
        .max(8)
        .nullish(),
    })
    .default({}),
});

export type CardSpec = z.infer<typeof cardSpecSchema>;
export type RenderedCard = CardSpec & { id: string; rows: Record<string, unknown>[]; error?: string };

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Runs one read-only aggregate query through the guarded SQL helper. */
export async function runAnalyticsSql(
  supabase: SupabaseLike,
  sql: string,
  limit = 500,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.rpc("analytics_query", { _sql: sql, _limit: limit });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

const SCHEMA_BRIEF = `TABLE public.surveillance_encounter (de-identified, one row per encounter)
  encounter_date timestamptz, encounter_day date, year int, month int, day_of_week text, hour_of_day int
  postal_code text, age_bracket text, industry text, is_pregnant bool
  weather_conditions jsonb  -- {temperature_mean_c, precipitation_mm, humidity_mean_pct, wind_max_kmh, summary}
  primary_icd_10 text, secondary_icd_10_codes jsonb (array), symptom_icd_codes jsonb (array),
  clinical_history_icd_codes jsonb (array), observations_loinc jsonb, prescription_atc_codes jsonb (array)
  encounter_type ('NEW_ISSUE','FOLLOW_UP','CHRONIC_FLARE_UP'), symptom_duration_category text,
  travel_history jsonb, urgency_level ('LOW','MEDIUM','HIGH_RED_FLAG'),
  disposition ('HOME_CARE','PRESCRIPTION','ER_REFERRAL'),
  sex, gender_identity, race_ethnicity (array), primary_language, marital_status, employment_status, insurance_type

TABLE public.icd10_code_lookup (code text, chapter text, description text) -- join for human labels

SQL rules:
- One single SELECT/WITH statement, no semicolon, no DML/DDL, no SET, no functions like pg_sleep.
- Only these two relations may be queried.
- Always filter the window: encounter_date >= now() - interval 'N days'.
- Expand jsonb arrays with jsonb_array_elements_text(coalesce(col,'[]'::jsonb)).
- Alias every output column with a short snake_case name; charts reference those names.
- Keep results small (<= 200 rows). Aggregate, never return raw rows.`;

function buildSystemInstruction(opts: { days: number; role: string; total: number; range: string }) {
  return `### CONTEXT
Audience: ${opts.role}. Window: last ${opts.days} days. ${opts.total.toLocaleString()} de-identified encounters available (${opts.range}).

### DATA MODEL
${SCHEMA_BRIEF}

### HOW YOU WORK
You work in steps. Every reply must be ONE JSON object and nothing else — no prose, no markdown fences.

To look at data:
{"tool":"run_query","sql":"select ...","note":"why"}
I answer with {"rows":[...]}.

When you are done (after at least 3 queries):
{"cards":[...],"narrative":"markdown assessment"}

Card shapes (config keys must match the column aliases in that card's sql):
- {"kind":"metric","title":"...","subtitle":"...","sql":"...","config":{"valueKey":"value","unit":"cases"}}
- {"kind":"alert","title":"...","config":{"severity":"critical|warning|info","text":"one or two sentences"}}
- {"kind":"line"|"area"|"bar","title":"...","sql":"...","config":{"xKey":"day","series":[{"key":"cases","label":"Cases"}]}}
- {"kind":"table","title":"...","sql":"...","config":{"columns":[{"key":"postal_code","label":"Postal"},{"key":"cases","label":"Cases"}]}}

Emit 6-10 cards: 3-4 metrics, the alerts that the data actually justifies, 2-3 charts (always include an epidemic curve of the signal you judge most important), and 1-2 tables (geographic and code-level detail). Order them: alerts, metrics, charts, tables.`;
}

function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json/gi, "```").split("```").filter(Boolean);
  const candidates = [text, ...cleaned];
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1));
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export type AnalysisResult = {
  narrative: string;
  cards: RenderedCard[];
  contextId: string | null;
  steps: { sql: string; note?: string; rows: number; error?: string }[];
};

/** Runs the agent tool loop and returns rendered cards plus a narrative. */
export async function runSurveillanceAnalysis(opts: {
  supabase: SupabaseLike;
  days: number;
  role: string;
  instruction: string;
  contextId?: string | null;
}): Promise<AnalysisResult> {
  const definition = getAgentDefinition("surveillance-intelligence");

  const overview = await runAnalyticsSql(
    opts.supabase,
    `select count(*)::int as total, min(encounter_day)::text as first_day, max(encounter_day)::text as last_day
     from surveillance_encounter where encounter_date >= now() - interval '${opts.days} days'`,
    1,
  ).catch(() => []);
  const total = Number((overview[0] as any)?.total ?? 0);
  const range = `${(overview[0] as any)?.first_day ?? "?"} → ${(overview[0] as any)?.last_day ?? "?"}`;

  let contextId = opts.contextId ?? null;
  let message = contextId
    ? `### REQUEST\n${opts.instruction}\n\nWindow: last ${opts.days} days. Reply with the JSON tool call or the final cards object.`
    : `${buildSystemInstruction({ days: opts.days, role: opts.role, total, range })}\n\n### REQUEST\n${opts.instruction}`;

  const steps: AnalysisResult["steps"] = [];

  for (let step = 0; step < 8; step++) {
    const reply = await sendAgentMessage({ definition, text: message, contextId });
    contextId = reply.contextId ?? contextId;

    const parsed = extractJson(reply.text ?? "");
    if (!parsed) {
      return { narrative: reply.text || "The analyst did not return a readable answer.", cards: [], contextId, steps };
    }

    if (parsed.tool === "run_query" && typeof parsed.sql === "string") {
      let rows: Record<string, unknown>[] = [];
      let error: string | undefined;
      try {
        rows = await runAnalyticsSql(opts.supabase, parsed.sql, 200);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      steps.push({ sql: parsed.sql, note: parsed.note, rows: rows.length, error });
      message = error
        ? `{"error":${JSON.stringify(error)}}\nFix the query and try again, or move on.`
        : `{"rows":${JSON.stringify(rows).slice(0, 12000)}}`;
      continue;
    }

    if (Array.isArray(parsed.cards)) {
      const cards = await renderCards(opts.supabase, parsed.cards, opts.days);
      return { narrative: String(parsed.narrative ?? ""), cards, contextId, steps };
    }

    // Unexpected shape — nudge once, then give up.
    message = `That was not a valid tool call or card set. Reply with {"tool":"run_query","sql":"..."} or {"cards":[...],"narrative":"..."}.`;
  }

  return { narrative: "The analyst ran out of steps before producing a dashboard.", cards: [], contextId, steps };
}

/** Validates agent-emitted card specs and executes their queries. */
export async function renderCards(
  supabase: SupabaseLike,
  raw: unknown[],
  days: number,
): Promise<RenderedCard[]> {
  const out: RenderedCard[] = [];

  for (const [i, candidate] of raw.entries()) {
    const parsed = cardSpecSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const spec = parsed.data;

    let rows: Record<string, unknown>[] = [];
    let error: string | undefined;
    if (spec.sql) {
      try {
        rows = await runAnalyticsSql(supabase, spec.sql, 300);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    if (spec.kind !== "alert" && !spec.sql) continue;
    if (error && spec.kind !== "alert") continue;

    out.push({ ...spec, id: `${Date.now()}-${i}`, rows, ...(error ? { error } : {}) });
  }

  void days;
  return out;
}
