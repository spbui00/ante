import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { IdCard, Search, ShieldAlert, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { PatientPassportPanel } from "@/components/ante/patient-passport-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  forceRequestPatientConsent,
  getMyPatients,
  removePatientFromRegistry,
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
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (patientId: string) => removePatientFromRegistry({ data: { patientId } }),
    onSuccess: (_r, patientId) => {
      toast.success("Patient removed from your registry");
      if (openId === patientId) setOpenId(null);
      setRemoveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["my-patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

      <div className="mb-4">
        <RegisterIntake />
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
                <div
                  key={g.id}
                  className={`flex items-start gap-1 border-b border-border pr-2 transition-colors last:border-0 hover:bg-muted ${
                    openId && openId === p?.id ? "bg-accent" : ""
                  }`}
                >
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => setOpenId(p!.id!)}
                    className="block flex-1 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
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
                  {p?.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${p.full_name ?? "patient"} from registry`}
                      className="mt-2 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setRemoveTarget({ id: p.id!, name: p.full_name ?? "this patient" })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
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

      <Drawer
        open={removeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Remove patient?</DrawerTitle>
            <DrawerDescription>
              This revokes your consent grant for {removeTarget?.name} and removes you from their
              care team. You will lose access to their passport.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
            >
              {removeMutation.isPending ? "Removing…" : "Remove patient"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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





function RegisterIntake() {
  const queryClient = useQueryClient();
  const [cpr, setCpr] = useState("");
  const [duration, setDuration] = useState<ConsentDuration>("1 year");
  const [forceOpen, setForceOpen] = useState(false);
  const [justification, setJustification] = useState("");

  const handleResult = (result: { ok: boolean; reason?: string; patient_name?: string }, okMsg: string) => {
    if (result.ok) {
      toast.success(okMsg.replace("{name}", result.patient_name ?? "the patient"));
      setCpr("");
      void queryClient.invalidateQueries({ queryKey: ["my-patients"] });
      return true;
    }
    if (result.reason === "not_found") toast.error("No patient found with that CPR number");
    else if (result.reason === "pending") toast.info("A request is already pending for this patient");
    else if (result.reason === "active") toast.info("You already have active access to this patient");
    else if (result.reason === "justification_too_short")
      toast.error("Justification must be at least 20 characters");
    else toast.error("This account is not a practitioner account");
    return false;
  };

  const request = useMutation({
    mutationFn: () => requestPatientConsent({ data: { cpr, duration } }),
    onSuccess: (result) => handleResult(result, "Consent request sent to {name}"),
    onError: () => toast.error("Could not send the consent request"),
  });

  const force = useMutation({
    mutationFn: () =>
      forceRequestPatientConsent({ data: { cpr, duration, justification } }),
    onSuccess: (result) => {
      if (handleResult(result, "Emergency access granted for {name} and logged")) {
        setForceOpen(false);
        setJustification("");
      }
    },
    onError: () => toast.error("Could not force access"),
  });

  return (
    <>
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
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={cpr.trim().length < 6}
            onClick={() => setForceOpen(true)}
          >
            <ShieldAlert className="size-4" />
            Force request
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            The patient approves the request with Face ID in their Ante app before their passport
            becomes visible to you. Force request is emergency break-glass access — it is granted
            immediately and logged against your licence.
          </p>
        </CardContent>
      </Card>

      <Drawer open={forceOpen} onOpenChange={setForceOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle>Force access (break glass)</DrawerTitle>
              <DrawerDescription>
                Emergency access to {formatCpr(cpr)} is granted immediately for {duration} without
                patient approval. It is logged against your licence and a justification of at least
                20 characters is mandatory.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <Textarea
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Clinical reason for overriding consent…"
              />
            </div>
            <DrawerFooter className="flex-row justify-end gap-2">
              <DrawerClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DrawerClose>
              <Button
                variant="destructive"
                disabled={justification.trim().length < 20 || force.isPending}
                onClick={() => force.mutate()}
              >
                {force.isPending ? "Granting…" : "Confirm emergency access"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

