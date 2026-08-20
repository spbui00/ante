import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Mic, ShieldCheck, Stethoscope } from "lucide-react";

import { AnteMark } from "@/components/ante/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ante — Clinical Passport & Epidemiological Intelligence" },
      {
        name: "description",
        content:
          "Ante pairs a patient-owned clinical passport with real-time epidemiological surveillance: AI voice intake, coded consultations, and anonymised population signal.",
      },
      { property: "og:title", content: "Ante — Clinical Passport & Epidemiological Intelligence" },
      {
        property: "og:description",
        content:
          "A patient-owned clinical passport, an AI-assisted consultation console, and a live public-health command centre.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: Mic,
    title: "Voice pre-intake",
    body: "Patients describe symptoms in their own words. Ante structures them into coded, triage-ready summaries before the consultation starts.",
  },
  {
    icon: Stethoscope,
    title: "Coded consultations",
    body: "Clinicians review AI-drafted symptoms, conclusion and recommendation with ICD-10/SKS diagnoses, LOINC observations and ATC prescriptions in one pass.",
  },
  {
    icon: Activity,
    title: "Population signal",
    body: "Every visit writes a de-identified encounter — postal code, age bracket, coded diagnosis — so analysts see outbreaks while they are still forming.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <AnteMark />
          <div className="ml-auto">
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <ShieldCheck className="size-3.5" />
          Consent-first clinical infrastructure
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
          The clinical passport that doubles as an early warning system.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Ante gives every patient a portable, consented record — and turns the same consultations
          into anonymised epidemiological signal for public health teams, in real time.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Explore the console</Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-border bg-secondary">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.title}>
              <p.icon className="size-6 text-foreground" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        Ante — demonstration platform. Not for clinical use.
      </footer>
    </main>
  );
}
