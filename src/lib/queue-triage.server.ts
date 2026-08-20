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

const SYSTEM_PROMPT = `You are a clinical triage coordinator for a Danish GP clinic.
You are given the patients currently waiting to be seen by one clinician.
Rank them into the order they should be taken in.

Rules:
- Red-flag / high urgency patients always come first.
- Among similar urgency, longer waiting time wins.
- A low-urgency patient who has waited a very long time (>90 minutes) may be moved ahead of a medium-urgency patient who just arrived.
- Never invent patients and never drop one.

Reply with ONLY JSON: {"order":[{"visitId":"...","reason":"short reason"}]}`;

export async function rankQueue(
  candidates: QueueCandidate[],
): Promise<{ order: string[]; reasons: Record<string, string>; source: "agent" | "heuristic" }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || candidates.length < 2) {
    return { order: heuristicOrder(candidates), reasons: {}, source: "heuristic" };
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(candidates) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
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
