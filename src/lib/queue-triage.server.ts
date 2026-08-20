/**
 * Triage prioritisation for the practitioner's patient queue.
 *
 * The agent ranks waiting patients on clinical urgency *and* waiting time
 * (so low-urgency patients cannot starve). Pinned rows are never moved.
 */

export type QueueCandidate = {
  visitId: string;
  patientName: string;
  urgency: string;
  encounterType: string;
  status: string;
  symptoms: string;
  waitedMinutes: number;
};

const URGENCY_WEIGHT: Record<string, number> = {
  HIGH_RED_FLAG: 1000,
  MEDIUM: 400,
  LOW: 100,
};

/** Deterministic fallback: urgency first, then one point per waiting minute. */
export function heuristicOrder(candidates: QueueCandidate[]): string[] {
  return [...candidates]
    .sort(
      (a, b) =>
        (URGENCY_WEIGHT[b.urgency] ?? 100) + b.waitedMinutes -
        ((URGENCY_WEIGHT[a.urgency] ?? 100) + a.waitedMinutes),
    )
    .map((c) => c.visitId);
}

export async function rankQueue(
  candidates: QueueCandidate[],
): Promise<{ order: string[]; reasons: Record<string, string>; source: "agent" | "heuristic" }> {
  if (candidates.length < 2) {
    return { order: heuristicOrder(candidates), reasons: {}, source: "heuristic" };
  }

  try {
    const { sendAgentMessage } = await import("@/lib/agents/corti-agents.server");
    const { getAgentDefinition } = await import("@/lib/agents/registry");

    const reply = await sendAgentMessage({
      definition: getAgentDefinition("queue-triage"),
      text: JSON.stringify(candidates),
      contextId: null,
    });

    const match = reply.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");

    const parsed = JSON.parse(match[0]) as { order?: { visitId?: string; reason?: string }[] };
    const valid = new Set(candidates.map((c) => c.visitId));
    const reasons: Record<string, string> = {};
    const order: string[] = [];

    for (const item of parsed.order ?? []) {
      if (item?.visitId && valid.has(item.visitId) && !order.includes(item.visitId)) {
        order.push(item.visitId);
        if (item.reason) reasons[item.visitId] = item.reason.slice(0, 240);
      }
    }
    // Anything the model forgot keeps its heuristic place at the end.
    for (const id of heuristicOrder(candidates)) if (!order.includes(id)) order.push(id);

    return { order, reasons, source: "agent" };
  } catch {
    return { order: heuristicOrder(candidates), reasons: {}, source: "heuristic" };
  }
}
