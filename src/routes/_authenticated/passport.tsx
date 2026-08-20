import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, Mic, Pill, Stethoscope } from "lucide-react";

import { AppShell } from "@/components/ante/app-shell";
import { VisitCard, type VisitCardData } from "@/components/ante/visit-card";
import { VoiceIntakeModal } from "@/components/ante/voice-intake-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPassport } from "@/lib/ante.functions";
import { formatDate, maskCpr } from "@/lib/clinical-utils";

const passportQuery = queryOptions({
  queryKey: ["passport"],
  queryFn: () => getPassport(),
});

export const Route = createFileRoute("/_authenticated/passport")({
  head: () => ({
    meta: [
      { title: "My Clinical Passport — Ante" },
      {
        name: "description",
        content:
          "Your portable clinical passport: conditions, allergies, medications, observations and visit history, plus voice pre-intake.",
      },
      { property: "og:title", content: "My Clinical Passport — Ante" },
      { property: "og:description", content: "Conditions, medications and visit history in one consented record." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(passportQuery),
  errorComponent: () => <AppShell title="Passport"><p className="text-sm text-muted-foreground">Could not load your passport.</p></AppShell>,
  notFoundComponent: () => <AppShell title="Passport"><p className="text-sm text-muted-foreground">Not found.</p></AppShell>,
  component: PassportPage,
});

function PassportPage() {
  const { data } = useSuspenseQuery(passportQuery);
  const [intakeOpen, setIntakeOpen] = useState(false);

  const conditions = data.records.filter((r) => r.category === "CONDITION");
  const allergies = data.records.filter((r) => r.category === "ALLERGY");
  const active = data.prescriptions.filter((p) => !p.end_date);

  return (
    <AppShell
      title={data.patient?.full_name ?? "My passport"}
      subtitle={
        data.patient
          ? `${maskCpr(data.patient.cpr_number)} · born ${formatDate(data.patient.date_of_birth)} · ${data.patient.postal_code ?? "—"}`
          : "No clinical record is linked to this account yet."
      }
      actions={
        <Button size="sm" onClick={() => setIntakeOpen(true)}>
          <Mic className="size-4" />
          <span className="hidden sm:inline">Voice intake</span>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Conditions" icon={<Stethoscope className="size-4" />}>
          {conditions.length === 0 ? <Empty /> : null}
          {conditions.map((c) => (
            <Row key={c.id} primary={c.description} secondary={[c.code, c.status].filter(Boolean).join(" · ")} />
          ))}
        </Section>

        <Section title="Allergies" icon={<AlertTriangle className="size-4" />}>
          {allergies.length === 0 ? <Empty label="No known allergies" /> : null}
          {allergies.map((a) => (
            <Row key={a.id} primary={a.description} secondary={a.status} />
          ))}
        </Section>

        <Section title="Active medications" icon={<Pill className="size-4" />}>
          {active.length === 0 ? <Empty /> : null}
          {active.map((p) => (
            <Row
              key={p.id}
              primary={p.drug_name}
              secondary={[p.dosage, p.frequency].filter(Boolean).join(" · ")}
            />
          ))}
        </Section>

        <Section title="Recent observations" icon={<Activity className="size-4" />} className="lg:col-span-1">
          {data.observations.length === 0 ? <Empty /> : null}
          {data.observations.slice(0, 8).map((o) => (
            <Row
              key={o.id}
              primary={o.test_name}
              secondary={`${o.value ?? "—"} ${o.unit ?? ""} · ${formatDate(o.recorded_at)}`}
            />
          ))}
        </Section>

        <Section title="Visit history" icon={<Stethoscope className="size-4" />} className="lg:col-span-2">
          {data.visits.length === 0 ? <Empty /> : null}
          <div className="space-y-3">
            {data.visits.map((v) => (
              <VisitCard
                key={v.id}
                visit={v as VisitCardData}
                onClick={() => navigate({ to: "/visits" })}
              />
            ))}
          </div>
        </Section>
      </div>

      <VoiceIntakeModal open={intakeOpen} onOpenChange={setIntakeOpen} />
    </AppShell>
  );
}

function Section({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Row({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <p className="text-sm font-medium text-foreground">{primary}</p>
      {secondary ? <p className="text-xs text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}

function Empty({ label = "Nothing recorded" }: { label?: string }) {
  return <p className="py-2 text-sm text-muted-foreground">{label}</p>;
}
