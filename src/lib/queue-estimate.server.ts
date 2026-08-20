/**
 * Charge Nurse wait-time estimation.
 *
 * Given the patients waiting in one clinician's room, the agent estimates how
 * many minutes each consultation will take. The backend then sums the people
 * ahead of a given patient to produce that patient's ETA.
 */

export type WaitingPatient = {
  id: string;
  symptoms: string;
  urgency: string;
  encounterType?: string;
};

const URGENCY_MINUTES: Record<string, number> = {
  HIGH_RED_FLAG: 25,
  MEDIUM: 15,
  LOW: 10,
};

/** Deterministic fallback when the agent is unavailable. */
export function heuristicDurations(patients: WaitingPatient[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of patients) {
    const base = URGENCY_MINUTES[p.urgency] ?? 10;
    const complexity = Math.min(10, Math.round((p.symptoms?.length ?? 0) / 160) * 5);
    out[p.id] = base + complexity;
  }
  return out;
}

export async function estimateDurations(
  patients: WaitingPatient[],
): Promise<{ durations: Record<string, number>; source: "agent" | "heuristic" }> {
  if (patients.length === 0) return { durations: {}, source: "heuristic" };

  try {
    const { sendAgentMessage } = await import("@/lib/agents/corti-agents.server");
    const { getAgentDefinition } = await import("@/lib/agents/registry");

    const reply = await sendAgentMessage({
      definition: getAgentDefinition("charge-nurse"),
      text: JSON.stringify(patients),
      contextId: null,
    });

    const match = reply.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");

    const parsed = JSON.parse(match[0].replace(/'/g, '"')) as Record<string, unknown>;
    const fallback = heuristicDurations(patients);
    const durations: Record<string, number> = {};
    for (const p of patients) {
      const raw = Number(parsed[p.id]);
      durations[p.id] =
        Number.isFinite(raw) && raw > 0 && raw <= 240 ? Math.round(raw) : (fallback[p.id] ?? 10);
    }
    return { durations, source: "agent" };
  } catch {
    return { durations: heuristicDurations(patients), source: "heuristic" };
  }
}

/** Rounds to a soft 5-minute bucket and renders a range label. */
export function bucketLabel(minutes: number): { label: string; range: string; rounded: number } {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const spread = rounded <= 15 ? 5 : 10;
  return {
    rounded,
    label: `~${rounded} minutes`,
    range: `${Math.max(0, rounded - spread)} – ${rounded + spread} minutes`,
  };
}
