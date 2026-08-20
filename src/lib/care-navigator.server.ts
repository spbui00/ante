/**
 * Care navigator: picks the best practitioner from the patient's care team for
 * a specific pre-intake, with a deterministic fallback when the agent is down.
 */

export type NavigatorCareTeamMember = {
  id: string;
  name: string;
  role: string;
  specialization: string | null;
};

export type NavigatorInput = {
  symptoms: string;
  urgency: string;
  encounterType: string;
  conditions: string[];
  careTeam: NavigatorCareTeamMember[];
};

export type NavigatorResult = {
  practitionerId: string | null;
  reason: string;
  suggestedSpecialization: string | null;
  confidence: "high" | "medium" | "low";
  source: "agent" | "heuristic";
};

/** Fallback: prefer the general/primary practitioner, else the first on file. */
export function heuristicRecommendation(input: NavigatorInput): NavigatorResult {
  const general = input.careTeam.find((m) =>
    /general|family|primary|gp/i.test(m.specialization ?? ""),
  );
  const pick = general ?? input.careTeam[0] ?? null;
  return {
    practitionerId: pick?.id ?? null,
    reason: pick
      ? `${pick.name} is on your care team and can review these symptoms.`
      : "You don't have a practitioner on file yet — search for a clinic below.",
    suggestedSpecialization: null,
    confidence: "low",
    source: "heuristic",
  };
}

export async function recommendPractitioner(input: NavigatorInput): Promise<NavigatorResult> {
  if (input.careTeam.length === 0) return heuristicRecommendation(input);

  try {
    const { sendAgentMessage } = await import("@/lib/agents/corti-agents.server");
    const { getAgentDefinition } = await import("@/lib/agents/registry");

    const reply = await sendAgentMessage({
      definition: getAgentDefinition("care-navigator"),
      text: JSON.stringify(input),
      contextId: null,
    });

    const match = reply.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");

    const parsed = JSON.parse(match[0]) as Partial<NavigatorResult>;
    const valid = new Set(input.careTeam.map((m) => m.id));
    const id =
      typeof parsed.practitionerId === "string" && valid.has(parsed.practitionerId)
        ? parsed.practitionerId
        : null;

    return {
      practitionerId: id,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : heuristicRecommendation(input).reason,
      suggestedSpecialization:
        typeof parsed.suggestedSpecialization === "string" && parsed.suggestedSpecialization.trim()
          ? parsed.suggestedSpecialization.trim()
          : null,
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
      source: "agent",
    };
  } catch {
    return heuristicRecommendation(input);
  }
}

const URGENCY_WEIGHT: Record<string, number> = {
  HIGH_RED_FLAG: 1000,
  MEDIUM: 400,
  LOW: 100,
};

/**
 * Where this patient would land in a practitioner's queue, using the same
 * urgency + waiting-time weighting the clinician's triage agent applies.
 */
export function predictPosition(
  myUrgency: string,
  waiting: { urgency: string; waitedMinutes: number }[],
): number {
  const mine = URGENCY_WEIGHT[myUrgency] ?? 100;
  const ahead = waiting.filter(
    (w) => (URGENCY_WEIGHT[w.urgency] ?? 100) + w.waitedMinutes >= mine,
  ).length;
  return ahead;
}
