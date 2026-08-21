import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveFocus } from "@/lib/outbreak-focus";

/** Population-level outbreak signals derived from de-identified encounters. */
export const getOutbreakIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        days: z.number().int().min(30).max(730).default(180),
        focus: z.string().trim().max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const focus = resolveFocus(data.focus);

    const { data: stats, error } = await (context.supabase.rpc as any)("outbreak_stats", {
      _days: data.days,
      _focus: focus.prefixes,
    });
    if (error) throw new Error(error.message);

    const { computeSignals } = await import("@/lib/outbreak.server");
    return computeSignals(stats as any, focus);
  });

/** Chat turn with the epidemiologist agent, grounded in the current signals. */
export const askOutbreakAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().trim().min(1).max(4000),
        contextId: z.string().max(200).nullish(),
        days: z.number().int().min(30).max(730).default(180),
        focus: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getAgentDefinition } = await import("@/lib/agents/registry");
    const { sendAgentMessage } = await import("@/lib/agents/corti-agents.server");

    let text = data.text;

    if (!data.contextId) {
      const focus = resolveFocus(data.focus);
      const { data: stats, error } = await (context.supabase.rpc as any)("outbreak_stats", {
        _days: data.days,
        _focus: focus.prefixes,
      });
      if (error) throw new Error(error.message);

      const { computeSignals, buildAnalystBriefing } = await import("@/lib/outbreak.server");
      const briefing = buildAnalystBriefing(computeSignals(stats as any, focus));
      text = `### CURRENT SURVEILLANCE SIGNAL (de-identified)\n${briefing}\n\n### ANALYST ASKS\n${data.text}`;
    }

    const reply = await sendAgentMessage({
      definition: getAgentDefinition("outbreak-analyst"),
      text,
      contextId: data.contextId ?? null,
    });

    return {
      reply: reply.text || "I couldn't read the signal just now — try again.",
      contextId: reply.contextId,
    };
  });
