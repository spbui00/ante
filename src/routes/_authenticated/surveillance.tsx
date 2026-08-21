import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/ante/app-shell";
import { IntelligencePanel } from "@/components/ante/intelligence-panel";

export const Route = createFileRoute("/_authenticated/surveillance")({
  head: () => ({
    meta: [
      { title: "Epidemiological Command Centre — Ante" },
      {
        name: "description",
        content:
          "Real-time anonymised surveillance: an epidemiologist agent builds the dashboard from the de-identified encounter log.",
      },
      { property: "og:title", content: "Epidemiological Command Centre — Ante" },
      {
        property: "og:description",
        content: "Live anonymised population signal from coded consultations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <AppShell title="Surveillance">
      <p className="text-sm text-muted-foreground">Could not load surveillance data.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Surveillance">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: SurveillancePage,
});

function SurveillancePage() {
  return (
    <AppShell
      title="Epidemiological command centre"
      subtitle="Agent-built population intelligence from the de-identified encounter log"
    >
      <IntelligencePanel />
    </AppShell>
  );
}
