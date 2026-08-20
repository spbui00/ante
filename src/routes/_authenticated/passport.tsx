import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, CalendarClock, Mic, Pill, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { CareNavigatorDrawer } from "@/components/ante/care-navigator-drawer";
import { ConsentRequests } from "@/components/ante/consent-requests";
import { QueueStatusCard } from "@/components/ante/queue-status-card";

import { VisitCard, type VisitCardData } from "@/components/ante/visit-card";
import {
  VisitDetailDrawer,
  type VisitDetail,
} from "@/components/ante/visit-detail-drawer";
import { VoiceIntakeModal } from "@/components/ante/voice-intake-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getPassport } from "@/lib/ante.functions";
import { deleteScheduledVisit } from "@/lib/intake.functions";
import { formatDate, formatCpr } from "@/lib/clinical-utils";

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
  const queryClient = useQueryClient();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [navigatorVisit, setNavigatorVisit] = useState<VisitDetail | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VisitDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  const conditions = data.records.filter((r) => r.category === "CONDITION");
  const allergies = data.records.filter((r) => r.category === "ALLERGY");
  const active = data.prescriptions.filter((p) => !p.end_date);
  const scheduled = data.visits.filter((v) => v.status === "SCHEDULED");
  const past = data.visits.filter((v) => v.status !== "SCHEDULED");


  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["passport"] });
    void queryClient.invalidateQueries({ queryKey: ["my-visit-history"] });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteScheduledVisit({ data: { visitId: pendingDelete.id } });
      toast.success("Scheduled visit deleted");
      setPendingDelete(null);
      setDetailOpen(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this visit");
    } finally {
      setDeleting(false);
    }
  }


  return (
    <AppShell
      title={data.patient?.full_name ?? "My passport"}
      subtitle={
        data.patient
          ? [
              formatCpr(data.patient.cpr_number),
              data.patient.date_of_birth ? `born ${formatDate(data.patient.date_of_birth)}` : null,
              data.patient.postal_code,
            ]
              .filter((part) => part && part !== "—")
              .join(" · ") || "No CPR or address on file yet."
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
        <ConsentRequests />

        <QueueStatusCard />

        {scheduled.length > 0 ? (
          <Section
            title="Scheduled visits"
            icon={<CalendarClock className="size-4" />}
            className="lg:col-span-3 border-primary/30 bg-primary/[0.04]"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {scheduled.map((v) => (
                <VisitCard
                  key={v.id}
                  visit={v as VisitCardData}
                  className="bg-card/60"
                  onClick={() => {
                    setNavigatorVisit(v as VisitDetail);
                    setNavigatorOpen(true);
                  }}
                  onEdit={() => {
                    setSelectedVisit(v as VisitDetail);
                    setEditOpen(true);
                  }}
                  onDelete={() => setPendingDelete(v as VisitDetail)}
                />
              ))}
            </div>
          </Section>
        ) : null}

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
          {past.length === 0 ? <Empty /> : null}
          <div className="space-y-3">
            {past.map((v) => (
              <VisitCard
                key={v.id}
                visit={v as VisitCardData}
                onClick={() => {
                  setSelectedVisit(v as VisitDetail);
                  setDetailOpen(true);
                }}
              />
            ))}
          </div>
        </Section>
      </div>

      <VisitDetailDrawer
        visit={selectedVisit}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => {
          setDetailOpen(false);
          setEditOpen(true);
        }}
        onDelete={() => selectedVisit && setPendingDelete(selectedVisit)}
      />

      <CareNavigatorDrawer
        visitId={navigatorVisit?.id ?? null}
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        onViewDetails={() => {
          if (navigatorVisit) {
            setSelectedVisit(navigatorVisit);
            setNavigatorOpen(false);
            setDetailOpen(true);
          }
        }}
      />

      {selectedVisit && selectedVisit.status === "SCHEDULED" ? (
        <VoiceIntakeModal
          key={selectedVisit.id}
          open={editOpen}
          onOpenChange={setEditOpen}
          visit={selectedVisit as never}
          onSaved={refresh}
        />
      ) : null}

      <Drawer open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader>
              <DrawerTitle>Delete this scheduled visit?</DrawerTitle>
              <DrawerDescription>
                Your pre-intake answers for{" "}
                {pendingDelete ? formatDate(pendingDelete.visit_date) : ""} will be permanently
                removed. This cannot be undone.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="flex-row justify-end gap-2">
              <Button variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>
                Keep it
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <VoiceIntakeModal open={intakeOpen} onOpenChange={setIntakeOpen} onSaved={refresh} />
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
