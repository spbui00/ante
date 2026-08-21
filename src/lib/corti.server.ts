/**
 * Corti API client (server-only).
 *
 * Covers the four pieces of the Ante pre-intake pipeline:
 *   1. Speech-to-text  -> /interactions + /recordings + /transcripts
 *   2. Clinical facts  -> /tools/extract-facts
 *   3. Text generation -> Corti Models (OpenAI-compatible chat completions)
 *   4. Medical coding  -> /tools/coding
 *
 * All credentials are read inside functions (never at module scope) so they
 * resolve correctly in the edge runtime.
 */

const ENVIRONMENT = "eu";
const TENANT = "base";

export const CORTI_ENVIRONMENT = ENVIRONMENT;
export const CORTI_TENANT = TENANT;

/**
 * Coding system used for ICD-10 predictions. The Danish SKS modification
 * (icd10dk-*) is alpha-only and rejected by the API on this tenant, so we use
 * the outpatient ICD-10-CM system, which is enabled and returns codes.
 */
export const CORTI_CODING_SYSTEM = "icd10cm-outpatient";

const API_BASE = `https://api.${ENVIRONMENT}.corti.app/v2`;
const AUTH_URL = `https://auth.${ENVIRONMENT}.corti.app/realms/${TENANT}/protocol/openid-connect/token`;
const MODELS_URL = `https://ai.${ENVIRONMENT}.corti.app/v1/chat/completions`;

let cachedToken: { value: string; expiresAt: number } | null = null;

export class CortiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getCortiToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) return cachedToken.value;

  const clientId = process.env["CORTI_CLIENT_ID"];
  const clientSecret = process.env["CORTI_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new CortiError("Corti credentials are not configured", 500);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "openid",
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new CortiError(
      `Corti authentication failed (${res.status}). Check the client id/secret and tenant.`,
      res.status,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };
  return cachedToken.value;
}

async function cortiFetch<T>(
  path: string,
  init: { method?: string; body?: BodyInit; contentType?: string } = {},
): Promise<T> {
  const token = await getCortiToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Tenant-Name": TENANT,
  };
  if (init.contentType) headers["Content-Type"] = init.contentType;

  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ?? null,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new CortiError(`Corti ${path} failed (${res.status}): ${detail.slice(0, 400)}`, res.status);
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* 1. Speech-to-text                                                    */
/* ------------------------------------------------------------------ */

export async function createInteraction(opts: {
  identifier: string;
  title?: string;
  patientIdentifier?: string;
}): Promise<string> {
  const data = await cortiFetch<{ interactionId: string }>("/interactions/", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      encounter: {
        identifier: opts.identifier,
        status: "planned",
        type: "consultation",
        title: opts.title ?? "Ante pre-intake",
        period: { startedAt: new Date().toISOString() },
      },
      ...(opts.patientIdentifier ? { patient: { identifier: opts.patientIdentifier } } : {}),
    }),
  });
  return data.interactionId;
}

/**
 * Creates an interaction for the real-time /streams endpoint (ambient
 * documentation) and returns the authenticated WebSocket URL for it.
 */
export async function createStreamInteraction(opts: {
  identifier: string;
  title?: string;
  patientIdentifier?: string;
}): Promise<{ interactionId: string; url: string }> {
  const data = await cortiFetch<{ interactionId: string; websocketUrl?: string }>(
    "/interactions/",
    {
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        encounter: {
          identifier: opts.identifier,
          status: "in-progress",
          type: "consultation",
          title: opts.title ?? "Ante ambient consultation",
          period: { startedAt: new Date().toISOString() },
        },
        ...(opts.patientIdentifier ? { patient: { identifier: opts.patientIdentifier } } : {}),
      }),
    },
  );

  const token = await getCortiToken();
  const base =
    data.websocketUrl ??
    `wss://api.${ENVIRONMENT}.corti.app/audio-bridge/v2/interactions/${data.interactionId}/streams?tenant-name=${encodeURIComponent(TENANT)}`;
  const separator = base.includes("?") ? "&" : "?";
  const url = `${base}${separator}token=${encodeURIComponent(`Bearer ${token}`)}`;

  return { interactionId: data.interactionId, url };
}


export async function uploadRecording(interactionId: string, audio: ArrayBuffer): Promise<string> {
  const data = await cortiFetch<{ recordingId: string }>(
    `/interactions/${interactionId}/recordings/`,
    { method: "POST", contentType: "application/octet-stream", body: audio },
  );
  return data.recordingId;
}

type TranscriptResponse = {
  id: string;
  status: string;
  transcripts?: { text?: string; transcript?: string }[] | null;
};

function joinTranscript(res: TranscriptResponse): string {
  return (res.transcripts ?? [])
    .map((t) => t.text ?? t.transcript ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Full dictation flow: interaction -> recording -> transcript text. */
export async function transcribeAudio(
  audio: ArrayBuffer,
  opts: { language?: string; identifier: string; patientIdentifier?: string },
): Promise<{ transcript: string; interactionId: string }> {
  const interactionId = await createInteraction({
    identifier: opts.identifier,
    ...(opts.patientIdentifier ? { patientIdentifier: opts.patientIdentifier } : {}),
  });
  const recordingId = await uploadRecording(interactionId, audio);

  let result = await cortiFetch<TranscriptResponse>(`/interactions/${interactionId}/transcripts/`, {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      recordingId,
      primaryLanguage: opts.language ?? "en",
      automaticPunctuation: true,
    }),
  });

  // Long recordings fall back to async processing; poll until finalised.
  for (let i = 0; i < 20 && result.status === "processing"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await cortiFetch<TranscriptResponse>(
      `/interactions/${interactionId}/transcripts/${result.id}`,
    );
  }

  return { transcript: joinTranscript(result), interactionId };
}

/* ------------------------------------------------------------------ */
/* 2. Clinical facts                                                    */
/* ------------------------------------------------------------------ */

export type CortiFact = { group: string; text: string };

export async function extractFacts(text: string, outputLanguage = "en"): Promise<CortiFact[]> {
  const data = await cortiFetch<{ facts?: { group: string; text?: string; value?: string }[] }>(
    "/tools/extract-facts/",
    {
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({ context: [{ type: "text", text }], outputLanguage }),
    },
  );
  return (data.facts ?? []).map((f) => ({ group: f.group, text: f.text ?? f.value ?? "" }));
}

/* ------------------------------------------------------------------ */
/* 3. Text generation (Corti Models, OpenAI-compatible)                 */
/* ------------------------------------------------------------------ */

export async function cortiChat(opts: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const token = await getCortiToken();
  const res = await fetch(MODELS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "corti-s1",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new CortiError(`Corti text generation failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/* ------------------------------------------------------------------ */
/* 4. Medical coding                                                    */
/* ------------------------------------------------------------------ */

export type CortiCode = { code: string; display: string; system: string };

export async function predictCodes(
  text: string,
  systems: string[] = [CORTI_CODING_SYSTEM],
): Promise<CortiCode[]> {
  const data = await cortiFetch<{
    codes?: { code: string; display?: string; system?: string }[];
  }>("/tools/coding/", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ system: systems, context: [{ type: "text", text }] }),
  });

  return (data.codes ?? []).map((c) => ({
    code: c.code,
    display: c.display ?? c.code,
    system: c.system ?? systems[0]!,
  }));
}
