import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { IdCard, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { RichTextInline } from "@/components/ante/rich-text";
import { VisitCard } from "@/components/ante/visit-card";
import { VisitDetailDrawer, type VisitDetail } from "@/components/ante/visit-detail-drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UrgencyBadge } from "@/components/ante/badges";
import {
  getMyPatients,
  getPatientRecord,
  requestPatientConsent,
} from "@/lib/ante.functions";
import {
  CONSENT_DURATION_OPTIONS,
  type ConsentDuration,
  formatDate,
  formatDateTime,
  formatCpr,
} from "@/lib/clinical-utils";

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

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <RegisterIntake />
        <RegisterVisit />
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
                    {formatCpr(p?.cpr_number)}
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
                  formatCpr(data.patient.cpr_number),
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


function RegisterIntake() {
  const queryClient = useQueryClient();
  const [cpr, setCpr] = useState("");
  const [duration, setDuration] = useState<ConsentDuration>("1 year");

  const request = useMutation({
    mutationFn: () => requestPatientConsent({ data: { cpr, duration } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Consent request sent to ${result.patient_name ?? "the patient"}`);
        setCpr("");
        void queryClient.invalidateQueries({ queryKey: ["my-patients"] });
        return;
      }
      if (result.reason === "not_found") toast.error("No patient found with that CPR number");
      else if (result.reason === "pending") toast.info("A request is already pending for this patient");
      else if (result.reason === "active") toast.info("You already have active access to this patient");
      else toast.error("This account is not a practitioner account");
    },
    onError: () => toast.error("Could not send the consent request"),
  });

  return (
    <Card className="border-primary/30 bg-primary/[0.04]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <IdCard className="size-4" />
          Register an intake
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1 space-y-2">
          <Label htmlFor="cpr">Patient CPR number</Label>
          <Input
            id="cpr"
            value={cpr}
            onChange={(e) => setCpr(e.target.value)}
            placeholder="DDMMYY-XXXX"
            maxLength={15}
            className="font-mono"
          />
        </div>
        <div className="w-36 space-y-2">
          <Label>Access duration</Label>
          <Select value={duration} onValueChange={(v) => setDuration(v as ConsentDuration)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONSENT_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={cpr.trim().length < 6 || request.isPending}
          onClick={() => request.mutate()}
        >
          {request.isPending ? "Requesting…" : "Request data"}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          The patient approves the request with Face ID in their Ante app before their passport
          becomes visible to you.
        </p>
      </CardContent>
    </Card>
  );
}

type ScheduledLookup = Awaited<ReturnType<typeof findScheduledVisitsByCpr>>;

function RegisterVisit() {
  const queryClient = useQueryClient();
  const [cpr, setCpr] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Extract<ScheduledLookup, { ok: true }> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: () => findScheduledVisitsByCpr({ data: { cpr } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(
          res.reason === "not_found"
            ? "No consented patient found with that CPR number"
            : "This account is not a practitioner account",
        );
        return;
      }
      setResult(res);
      setSelected(res.visits[0]?.id ?? null);
      setOpen(true);
    },
    onError: () => toast.error("Could not look up scheduled visits"),
  });

  const register = useMutation({
    mutationFn: () => registerVisitArrival({ data: { visitId: selected! } }),
    onSuccess: () => {
      toast.success("Visit registered — patient added to your queue");
      setOpen(false);
      setCpr("");
      setResult(null);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
    },
    onError: () => toast.error("Could not register the visit"),
  });

  return (
    <>
      <Card className="border-primary/30 bg-primary/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarPlus className="size-4" />
            Register a visit
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1 space-y-2">
            <Label htmlFor="visit-cpr">Patient CPR number</Label>
            <Input
              id="visit-cpr"
              value={cpr}
              onChange={(e) => setCpr(e.target.value)}
              placeholder="DDMMYY-XXXX"
              maxLength={15}
              className="font-mono"
            />
          </div>
          <Button
            disabled={cpr.trim().length < 6 || lookup.isPending}
            onClick={() => lookup.mutate()}
          >
            {lookup.isPending ? "Checking…" : "Create visit"}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Use this when the patient arrives physically — it moves their pre-intake into your
            consultation queue.
          </p>
        </CardContent>
      </Card>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col">
            <DrawerHeader>
              <DrawerTitle>Scheduled visits</DrawerTitle>
              <DrawerDescription>
                {result?.patient.full_name} · {formatCpr(result?.patient.cpr_number)} — pick the
                pre-intake the patient is here for.
              </DrawerDescription>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {result && result.visits.length > 0 ? (
                <div className="space-y-2">
                  {result.visits.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelected(v.id)}
                      className={`block w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        selected === v.id
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {formatDateTime(v.visit_date)}
                        </span>
                        <span className="ml-auto">
                          <UrgencyBadge level={v.urgency_level} />
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ENCOUNTER_TYPE_LABEL[v.encounter_type ?? ""] ?? "Visit"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {v.symptoms || v.conclusion || "No pre-intake detail recorded."}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  This patient has no scheduled pre-intake forms.
                </p>
              )}
            </div>

            <DrawerFooter className="flex-row justify-end gap-2">
              <DrawerClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DrawerClose>
              <Button
                disabled={!selected || register.isPending}
                onClick={() => register.mutate()}
              >
                {register.isPending ? "Registering…" : "Register"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
