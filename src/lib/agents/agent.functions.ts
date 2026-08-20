import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAgentDefinition } from "@/lib/agents/registry";

/**
 * Generic entry point for every Ante agent. The client sends an agent key plus
 * a user turn; the server resolves the definition from the registry, prepends
 * the patient's clinical record on the first turn, and relays the reply.
 */
export const sendAgentTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentKey: z.string().min(1).max(64),
        text: z.string().min(1).max(8000),
        contextId: z.string().max(200).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const definition = getAgentDefinition(data.agentKey);

    const { sendAgentMessage } = await import("@/lib/agents/corti-agents.server");

    let text = data.text;

    // Patient context is only worth sending once, at the start of a thread.
    if (!data.contextId && definition.includePatientContext) {
      const { buildPatientContext } = await import("@/lib/agents/patient-context.server");
      const briefing = await buildPatientContext(context.supabase, context.userId).catch(
        () => "",
      );
      if (briefing) text = `${briefing}\n\n### PATIENT SAYS\n${data.text}`;
    }

    const reply = await sendAgentMessage({
      definition,
      text,
      contextId: data.contextId ?? null,
    });

    return {
      reply: reply.text || "Sorry, I didn't catch that — could you say it again?",
      contextId: reply.contextId,
    };
  });
