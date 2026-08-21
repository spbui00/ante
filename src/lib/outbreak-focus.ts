/**
 * Pathogen / condition "focus" presets for the surveillance dashboard.
 * Client-safe: no secrets, no server imports.
 *
 * A focus is just a set of ICD-10 code prefixes. Any encounter whose primary
 * code — or any symptom code — starts with one of the prefixes counts toward
 * the focus series, growth cards, hotspots and age mix.
 */

export type OutbreakFocus = {
  id: string;
  label: string;
  short: string;
  prefixes: string[];
  description: string;
};

export const OUTBREAK_FOCUSES: OutbreakFocus[] = [
  {
    id: "covid",
    label: "COVID-19 (U07)",
    short: "COVID-19",
    prefixes: ["U07"],
    description: "Confirmed and suspected SARS-CoV-2 coded encounters.",
  },
  {
    id: "influenza",
    label: "Influenza (J09–J11)",
    short: "Influenza",
    prefixes: ["J09", "J10", "J11"],
    description: "Identified, seasonal and unidentified influenza virus.",
  },
  {
    id: "respiratory",
    label: "All respiratory (J)",
    short: "Respiratory",
    prefixes: ["J"],
    description: "Whole ICD-10 respiratory chapter, including pneumonia.",
  },
  {
    id: "pneumonia",
    label: "Pneumonia (J12–J18)",
    short: "Pneumonia",
    prefixes: ["J12", "J13", "J14", "J15", "J16", "J17", "J18"],
    description: "Viral, bacterial and unspecified-organism pneumonia.",
  },
  {
    id: "gastro",
    label: "Gastrointestinal infection (A08–A09)",
    short: "GI infection",
    prefixes: ["A08", "A09"],
    description: "Viral and presumed-infectious gastroenteritis.",
  },
  {
    id: "measles",
    label: "Measles / rubella (B05–B06)",
    short: "Measles",
    prefixes: ["B05", "B06"],
    description: "Vaccine-preventable exanthematous viral disease.",
  },
  {
    id: "meningitis",
    label: "Meningitis (G00–G03, A39)",
    short: "Meningitis",
    prefixes: ["G00", "G01", "G02", "G03", "A39"],
    description: "Bacterial, viral and meningococcal meningitis.",
  },
];

export const DEFAULT_FOCUS_ID = "covid";

/** Resolve a focus id, or a raw comma-separated prefix list, to prefixes + label. */
export function resolveFocus(input?: string | null): { id: string; label: string; short: string; prefixes: string[] } {
  const raw = (input ?? DEFAULT_FOCUS_ID).trim();
  const preset = OUTBREAK_FOCUSES.find((f) => f.id === raw);
  if (preset) {
    return { id: preset.id, label: preset.label, short: preset.short, prefixes: preset.prefixes };
  }

  const prefixes = raw
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 12);

  if (prefixes.length === 0) {
    const fallback = OUTBREAK_FOCUSES[0]!;
    return {
      id: fallback.id,
      label: fallback.label,
      short: fallback.short,
      prefixes: fallback.prefixes,
    };
  }

  const label = `Custom (${prefixes.join(", ")})`;
  return { id: raw, label, short: prefixes.join("/"), prefixes };
}
