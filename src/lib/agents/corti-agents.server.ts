/**
 * Corti Agentic Framework (v2) runtime — server only.
 *
 * Generic plumbing shared by every agent in `registry.ts`:
 *   - ensureAgent(): find-or-create the agent in Corti, cached by name
 *   - sendAgentMessage(): A2A `message:send`, returns the agent's reply text
 *
 * Adding another agent requires no changes here — just a new registry entry.
 */

import { CORTI_ENVIRONMENT, CORTI_TENANT, CortiError, getCortiToken } from "@/lib/corti.server";
import type { AgentDefinition } from "@/lib/agents/registry";

const AGENTIC_BASE = `https://api.${CORTI_ENVIRONMENT}.corti.app/v2/agentic`;

/** name -> agent id. Warm cache; re-resolved from Corti after a cold start. */
const agentIdCache = new Map<string, string>();

async function agenticFetch<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const token = await getCortiToken();
  const res = await fetch(`${AGENTIC_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Tenant-Name": CORTI_TENANT,
      "A2A-Version": "1.0",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : null,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new CortiError(
      `Corti agentic ${path} failed (${res.status}): ${detail.slice(0, 400)}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

type AgentRecord = { id: string; name: string };

async function findAgentByName(name: string): Promise<string | null> {
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const query = new URLSearchParams({ pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const data = await agenticFetch<{ agents?: AgentRecord[]; nextPageToken?: string }>(
      `/agents?${query.toString()}`,
    );
    const hit = (data.agents ?? []).find((a) => a.name === name);
    if (hit) return hit.id;
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return null;
}

async function createAgent(def: AgentDefinition, withConnectors: boolean): Promise<string> {
  const data = await agenticFetch<{ id: string }>("/agents", {
    method: "POST",
    body: {
      name: def.name,
      description: def.description,
      systemPrompt: def.systemPrompt,
      lifecycle: "persistent",
      visibility: "private",
      ...(withConnectors && def.connectors?.length ? { connectors: def.connectors } : {}),
    },
  });
  return data.id;
}

/** Find-or-create the Corti agent for a definition and return its id. */
export async function ensureAgent(def: AgentDefinition): Promise<string> {
  const cached = agentIdCache.get(def.name);
  if (cached) return cached;

  let id = await findAgentByName(def.name).catch(() => null);

  if (!id) {
    try {
      id = await createAgent(def, true);
    } catch (error) {
      // A connector name that this tenant cannot use should not break intake.
      console.warn("Corti agent create with connectors failed, retrying bare", error);
      id = await createAgent(def, false);
    }
  }

  agentIdCache.set(def.name, id);
  return id;
}

export type AgentReply = { text: string; contextId: string | null; taskId: string | null };

type A2APart = { text?: string };
type A2AMessage = { role?: string; parts?: A2APart[]; messageId?: string; contextId?: string };
type A2AResponse = {
  message?: A2AMessage;
  task?: {
    id?: string;
    contextId?: string;
    history?: A2AMessage[];
    status?: { state?: string };
    artifacts?: { parts?: A2APart[] }[];
  };
};

function partsToText(parts: A2APart[] | undefined) {
  return (parts ?? [])
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Send one user turn to an agent and return the agent's reply. */
export async function sendAgentMessage(opts: {
  definition: AgentDefinition;
  text: string;
  contextId?: string | null;
}): Promise<AgentReply> {
  const agentId = await ensureAgent(opts.definition);

  const data = await agenticFetch<A2AResponse>(`/agents/${agentId}/a2a/message:send`, {
    method: "POST",
    body: {
      message: {
        role: "ROLE_USER",
        parts: [{ text: opts.text }],
        ...(opts.contextId ? { contextId: opts.contextId } : {}),
      },
    },
  });

  if (data.message) {
    return {
      text: partsToText(data.message.parts),
      contextId: data.message.contextId ?? null,
      taskId: null,
    };
  }

  const task = data.task;
  const lastAgentMessage = [...(task?.history ?? [])]
    .reverse()
    .find((m) => m.role === "ROLE_AGENT");

  const text =
    partsToText(lastAgentMessage?.parts) ||
    partsToText(task?.artifacts?.[0]?.parts) ||
    "";

  return { text, contextId: task?.contextId ?? null, taskId: task?.id ?? null };
}
