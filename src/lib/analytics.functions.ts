import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cardInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(240).nullish(),
  kind: z.enum(["metric", "alert", "line", "area", "bar", "combo", "table"]),
  sql: z.string().max(4000).nullish(),
  config: z.record(z.string(), z.any()).default({}),
  windowDays: z.number().int().min(1).max(730).default(60),
});

async function describeCaller(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (roles.includes("ANALYST")) return "a public-health analyst";
  if (roles.includes("PRACTITIONER")) return "a clinician (doctor or nurse) in primary care";
  return "a member of the public (patient)";
}

/** Runs the epidemiologist agent over the whole de-identified log and returns a dashboard. */
export const analyzeSurveillance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        days: z.number().int().min(7).max(730).default(60),
        instruction: z.string().trim().max(2000).optional(),
        contextId: z.string().max(200).nullish(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const role = await describeCaller(context.supabase, context.userId);
    const { runSurveillanceAnalysis } = await import("@/lib/analytics-agent.server");

    const result = await runSurveillanceAnalysis({
      supabase: context.supabase as any,
      days: data.days,
      role,
      contextId: data.contextId ?? null,
      instruction:
        data.instruction?.trim() ||
        "Analyse the whole de-identified encounter log for this window. Find what is actually happening — growth signals, geographic clusters, severity shifts, age or seasonal patterns — with no assumption about which disease it is. Then build the dashboard.",
    });

    // Persist this batch as the user's "last generated" dashboard so it survives navigation.
    await context.supabase
      .from("analytics_card")
      .delete()
      .eq("owner_id", context.userId)
      .eq("pinned", false);

    let cards = result.cards;
    if (cards.length) {
      const { data: saved } = await context.supabase
        .from("analytics_card")
        .insert(
          cards.map((c: any, i: number) => ({
            owner_id: context.userId,
            title: c.title,
            subtitle: c.subtitle ?? null,
            kind: c.kind,
            sql_query: c.sql ?? "",
            config: (c.config ?? {}) as never,
            window_days: data.days,
            position: i,
            pinned: false,
          })),
        )
        .select("id");
      if (saved?.length === cards.length) {
        cards = cards.map((c: any, i: number) => ({ ...c, id: String(saved[i]?.id ?? c.id) }));
      }
    }

    await context.supabase.from("analytics_session").upsert({
      owner_id: context.userId,
      narrative: result.narrative ?? null,
      context_id: result.contextId ?? null,
      window_days: data.days,
      updated_at: new Date().toISOString(),
    });

    return {
      narrative: result.narrative,
      cards,
      contextId: result.contextId,
      steps: result.steps.map((s) => ({ note: s.note ?? "", rows: s.rows, error: s.error ?? null })),
    };
  });

/** Chat turn with the analyst; may also return new/updated cards. */
export const chatWithAnalyst = analyzeSurveillance;

/** Pinned cards plus the last generated dashboard, re-executed against live data. */
export const listAnalyticsCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analytics_card")
      .select("*")
      .eq("owner_id", context.userId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    const { runAnalyticsSql } = await import("@/lib/analytics-agent.server");
    type Row = Record<string, string | number | boolean | null>;

    const all = await Promise.all(
      (data ?? []).map(async (c: any) => {
        let rows: Row[] = [];
        let err: string | null = null;
        if (c.sql_query) {
          try {
            rows = await runAnalyticsSql(context.supabase as any, c.sql_query, 300);
          } catch (e) {
            err = e instanceof Error ? e.message : String(e);
          }
        }
        return {
          id: c.id as string,
          title: c.title as string,
          subtitle: (c.subtitle ?? null) as string | null,
          kind: c.kind as string,
          sql: (c.sql_query ?? null) as string | null,
          config: (c.config ?? {}) as Record<string, never>,
          windowDays: c.window_days as number,
          pinned: Boolean(c.pinned),
          rows,
          error: err,
        };
      }),
    );

    const { data: session } = await context.supabase
      .from("analytics_session")
      .select("narrative, context_id, window_days")
      .eq("owner_id", context.userId)
      .maybeSingle();

    return {
      pinned: all.filter((c) => c.pinned),
      generated: all.filter((c) => !c.pinned),
      narrative: (session?.narrative ?? "") as string,
      contextId: (session?.context_id ?? null) as string | null,
      windowDays: (session?.window_days ?? 60) as number,
    };
  });

/** Pins a card the agent produced so it renders without re-analysing. */
export const saveAnalyticsCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cardInput.parse(input))
  .handler(async ({ data, context }) => {
    // Cards produced by an analysis already exist as unpinned rows — just flip the flag.
    if (data.id) {
      const { data: updated } = await context.supabase
        .from("analytics_card")
        .update({ pinned: true, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("id")
        .maybeSingle();
      if (updated) return { id: updated.id as string };
    }

    const { count } = await context.supabase
      .from("analytics_card")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId);

    const { data: row, error } = await context.supabase
      .from("analytics_card")
      .insert({
        owner_id: context.userId,
        title: data.title,
        subtitle: data.subtitle ?? null,
        kind: data.kind,
        sql_query: data.sql ?? "",
        config: data.config as never,
        window_days: data.windowDays,
        position: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id as string };
  });

/** Removes a pinned card. */
export const deleteAnalyticsCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("analytics_card")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
