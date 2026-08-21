/** Client-safe clinical helpers shared by UI and server functions. */

export const AGE_BRACKETS = ["0-9", "10-19", "20-39", "40-59", "60-79", "80+"] as const;

export function ageBracketFromDob(dob: string | null | undefined): string {
  if (!dob) return "unknown";
  const birth = new Date(dob);
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age < 10) return "0-9";
  if (age < 20) return "10-19";
  if (age < 40) return "20-39";
  if (age < 60) return "40-59";
  if (age < 80) return "60-79";
  return "80+";
}

export function symptomDurationCategory(days: number | null | undefined): string {
  if (days == null) return "unknown";
  if (days < 3) return "<3 days";
  if (days <= 7) return "3-7 days";
  if (days <= 28) return "1-4 weeks";
  return ">1 month";
}

export const URGENCY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH_RED_FLAG: "Red flag",
};

export const DISPOSITION_LABEL: Record<string, string> = {
  HOME_CARE: "Home care",
  PRESCRIPTION: "Prescription",
  ER_REFERRAL: "ER referral",
};

export const ENCOUNTER_TYPE_LABEL: Record<string, string> = {
  NEW_ISSUE: "New issue",
  FOLLOW_UP: "Follow-up",
  CHRONIC_FLARE_UP: "Chronic flare-up",
};

export function maskCpr(cpr: string | null | undefined): string {
  if (!cpr) return "—";
  return `${cpr.slice(0, 6)}-••••`;
}

/** Full CPR, normalised to DDMMYY-XXXX. Clinicians with access see this in full. */
export function formatCpr(cpr: string | null | undefined): string {
  if (!cpr) return "—";
  const digits = cpr.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return cpr;
}


export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const CONSENT_DURATIONS = {
  "1 hour": "1 hour",
  "1 day": "1 day",
  "1 week": "7 days",
  "1 month": "1 month",
  "1 year": "1 year",
  "3 years": "3 years",
} as const;

export type ConsentDuration = keyof typeof CONSENT_DURATIONS;

export const CONSENT_DURATION_OPTIONS = Object.keys(CONSENT_DURATIONS) as ConsentDuration[];

/** Internal marker linking an auto-generated follow-up draft to its source visit. */
export const FOLLOW_UP_MARKER_RE = /^\[AUTO_FOLLOW_UP:[0-9a-f-]+\]\s*$/gim;

/** Hides the internal follow-up marker from anything user- or agent-facing. */
export function stripFollowUpMarker(text?: string | null) {
  return (text ?? "").replace(FOLLOW_UP_MARKER_RE, "").trim();
}

/**
 * Vital signs fluctuate every encounter, so the passport only ever shows the
 * most recent value for each of them; everything else (labs, imaging, scores)
 * is trend-worthy and kept in full so we can chart it later.
 */
const VITAL_SIGN_NAMES = [
  "temperature",
  "heart rate",
  "pulse",
  "respiratory rate",
  "oxygen saturation",
  "spo2",
  "systolic blood pressure",
  "diastolic blood pressure",
  "blood pressure",
  "weight",
  "height",
  "pain score",
];

export function isVitalSign(testName: string | null | undefined): boolean {
  const n = (testName ?? "").trim().toLowerCase();
  return VITAL_SIGN_NAMES.some((v) => n === v || n.startsWith(v));
}

type ObservationLike = {
  id: string;
  test_name: string;
  status?: string | null;
  recorded_at: string;
  ordered_date?: string | null;
};

/**
 * Orders observations for the passport: pending/ordered tests first, then the
 * latest value per vital sign, then other results newest-first.
 */
export function summariseObservations<T extends ObservationLike>(list: T[]): T[] {
  const sorted = [...list].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
  const pending = sorted.filter((o) => o.status === "ORDERED" || o.status === "PENDING");
  const done = sorted.filter((o) => o.status !== "ORDERED" && o.status !== "PENDING");

  const seenVital = new Set<string>();
  const rest = done.filter((o) => {
    if (!isVitalSign(o.test_name)) return true;
    const key = o.test_name.trim().toLowerCase();
    if (seenVital.has(key)) return false;
    seenVital.add(key);
    return true;
  });

  return [...pending, ...rest];
}
