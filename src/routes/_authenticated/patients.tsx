import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { AppShell } from "@/components/ante/app-shell";
import { RichTextInline } from "@/components/ante/rich-text";
import { VisitCard } from "@/components/ante/visit-card";
import { VisitDetailDrawer, type VisitDetail } from "@/components/ante/visit-detail-drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { getMyPatients, getPatientRecord } from "@/lib/ante.functions";
import { formatDate, formatDateTime, maskCpr } from "@/lib/clinical-utils";

const patientsQuery = queryOptions({
  queryKey: ["my-patients"],
  queryFn: () => getMyPatients(),
});

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Patient Registry — Ante" },
      {
        name: "description",
        content:
          "Every patient who has granted you access to their clinical passport, with consent status and expiry.",
      },
      { property: "og:title", content: "Patient Registry — Ante" },
      {
        property: "og:description",
        content: "Consented patients and their clinical passports in one registry.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsQuery),
  errorComponent: () => (
    <AppShell title="Patients">
      <p className="text-sm text-muted-foreground">Could not load your patient registry.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Patients">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: PatientsPage,
});

function PatientsPage() {
  const { data } = useSuspenseQuery(patientsQuery);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const grants = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.grants.filter((g) => {
      const p = g.patient as { full_name?: string; cpr_number?: string } | null;
      if (!needle) return true;
      return [p?.full_name, p?.cpr_number].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [data.grants, q]);

  const activeCount = data.grants.filter((g) => g.status === "ACTIVE").length;

  return (
    <AppShell
      title="Patient registry"
      subtitle={`${activeCount} active consent${activeCount === 1 ? "" : "s"} · ${data.grants.length} total requests`}
    >
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or CPR…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4" />
              My patients
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto p-0">
            {grants.map((g) => {
              const p = g.patient as {
                id?: string;
                full_name?: string;
                cpr_number?: string;
                date_of_birth?: string | null;
              } | null;
              const usable = g.status === "ACTIVE" && Boolean(p?.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!usable}
                  onClick={() => setOpenId(p!.id!)}
                  className={`block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${
                    openId && openId === p?.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {p?.full_name ?? "Unknown"}
                    </span>
                    <span className="ml-auto">
                      <StatusPill status={g.status} emergency={g.is_emergency_override} />
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {maskCpr(p?.cpr_number)}
                    {p?.date_of_birth ? ` · born ${formatDate(p.date_of_birth)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {g.expires_at ? `Until ${formatDateTime(g.expires_at)}` : "No expiry"}
                  </p>
                </button>
              );
            })}
            {grants.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {data.grants.length === 0
                  ? "No patients yet. Request access with a CPR number from the consultation console."
                  : "No patients match this search."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {openId ? (
          <PatientPassportPanel patientId={openId} />
        ) : (
          <Card className="h-fit">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Select a patient to open their clinical passport.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StatusPill({ status, emergency }: { status: string; emergency?: boolean }) {
  const tone =
    status === "ACTIVE"
      ? "border-primary/40 bg-primary/10 text-primary"
      : status === "PENDING"
        ? "border-border bg-muted text-muted-foreground"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>
      {emergency ? "Break-glass · " : ""}
      {status.toLowerCase()}
    </span>
  );
}

function PatientPassportPanel({ patientId }: { patientId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["patient-record", patientId],
    queryFn: () => getPatientRecord({ data: { patientId } }),
  });

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [openVisit, setOpenVisit] = useState<VisitDetail | null>(null);

  const allVisits = (data?.visits ?? []) as (VisitDetail & { practitioner_id?: string | null })[];
  const mine = data?.viewerPractitionerId
    ? allVisits.filter((v) => v.practitioner_id === data.viewerPractitionerId)
    : [];
  const visits = scope === "mine" ? mine : allVisits;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{data?.patient?.full_name ?? "Patient passport"}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {data?.patient
              ? [
                  maskCpr(data.patient.cpr_number),
                  data.patient.date_of_birth ? `born ${formatDate(data.patient.date_of_birth)}` : null,
                  data.patient.postal_code,
                ]
                  .filter((x) => x && x !== "—")
                  .join(" · ")
              : "Loading consented record…"}
          </p>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Tabs defaultValue="medical">
              <TabsList>
                <TabsTrigger value="medical">Medical info</TabsTrigger>
                <TabsTrigger value="visits">Visits</TabsTrigger>
              </TabsList>

              <TabsContent value="medical" className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Group title="Conditions">
                    {(data?.records ?? [])
                      .filter((r) => r.category === "CONDITION")
                      .map((r) => (
                        <Line key={r.id} primary={r.description} secondary={r.code ?? undefined} />
                      ))}
                  </Group>
                  <Group title="Allergies">
                    {(data?.records ?? [])
                      .filter((r) => r.category === "ALLERGY")
                      .map((r) => (
                        <Line key={r.id} primary={r.description} secondary={r.status} />
                      ))}
                  </Group>
                  <Group title="Active medications">
                    {(data?.prescriptions ?? [])
                      .filter((p) => !p.end_date)
                      .map((p) => (
                        <Line
                          key={p.id}
                          primary={p.drug_name}
                          secondary={[p.dosage, p.frequency].filter(Boolean).join(" · ")}
                        />
                      ))}
                  </Group>
                  <Group title="Recent observations">
                    {(data?.observations ?? []).slice(0, 8).map((o) => (
                      <Line
                        key={o.id}
                        primary={o.test_name}
                        secondary={`${o.value ?? "—"} ${o.unit ?? ""} · ${formatDate(o.recorded_at)}`}
                      />
                    ))}
                  </Group>
                </div>
              </TabsContent>

              <TabsContent value="visits" className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={scope === "mine" ? "default" : "outline"}
                    onClick={() => setScope("mine")}
                  >
                    My visits ({mine.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={scope === "all" ? "default" : "outline"}
                    onClick={() => setScope("all")}
                  >
                    All practitioners ({allVisits.length})
                  </Button>
                </div>

                {visits.map((v) => (
                  <VisitCard key={v.id} visit={v} onClick={() => setOpenVisit(v)} />
                ))}
                {visits.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    {scope === "mine"
                      ? "No visits with you yet. Switch to all practitioners to see the full history."
                      : "No visits recorded."}
                  </p>
                ) : null}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <VisitDetailDrawer
        visit={openVisit}
        open={Boolean(openVisit)}
        onOpenChange={(o) => !o && setOpenVisit(null)}
      />
    </div>
  );
}

function Group({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {empty ? <p className="py-2 text-sm text-muted-foreground">Nothing recorded</p> : children}
      </CardContent>
    </Card>
  );
}

function Line({ primary, secondary }: { primary: string; secondary?: string | undefined }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <RichTextInline className="text-sm font-medium text-foreground" text={primary} />
      {secondary ? (
        <RichTextInline className="text-xs text-muted-foreground" text={secondary} />
      ) : null}
    </div>
  );
}
