import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarPlus,
  Filter,
  GripVertical,
  Pin,
  PinOff,
  Search,
  ShieldAlert,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { CodeChip, DispositionBadge, UrgencyBadge } from "@/components/ante/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  breakGlass,
  finaliseVisit,
  findScheduledVisitsByCpr,
  getClinicalQueue,
  markVisitTakenIn,
  registerVisitArrival,
} from "@/lib/ante.functions";
import { prioritizeQueue, saveQueueOrder } from "@/lib/queue.functions";
import {
  ENCOUNTER_TYPE_LABEL,
  URGENCY_LABEL,
  formatDateTime,
  formatCpr,
} from "@/lib/clinical-utils";

const queueQuery = queryOptions({
  queryKey: ["clinical-queue"],
  queryFn: () => getClinicalQueue(),
});

const ANY = "__any__";

type Filters = {
  q: string;
  activeOnly: boolean;
  urgency: string;
  encounterType: string;
  from: string;
  to: string;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  activeOnly: true,
  urgency: ANY,
  encounterType: ANY,
  from: "",
  to: "",
};


export const Route = createFileRoute("/_authenticated/clinical")({
  head: () => ({
    meta: [
      { title: "Consultation Console — Ante" },
      {
        name: "description",
        content:
          "Practitioner console: patient queue with urgency triage, AI-drafted visit summaries, ICD-10/SKS coding and prescriptions.",
      },
      { property: "og:title", content: "Consultation Console — Ante" },
      { property: "og:description", content: "Triage, review and sign off AI-drafted consultations." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(queueQuery),
  errorComponent: () => (
    <AppShell title="Clinical">
      <p className="text-sm text-muted-foreground">Could not load the clinical queue.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Clinical">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: ClinicalPage,
});

type QueueVisit = Awaited<ReturnType<typeof getClinicalQueue>>["visits"][number];

function ClinicalPage() {
  const { data } = useSuspenseQuery(queueQuery);
  const queryClient = useQueryClient();
  const finalise = useServerFn(finaliseVisit);
  const glass = useServerFn(breakGlass);

  const [selectedId, setSelectedId] = useState<string | null>(data.visits[0]?.id ?? null);
  const [glassOpen, setGlassOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [order, setOrder] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  // Sync local queue state whenever the server queue changes.
  useEffect(() => {
    setOrder(data.queue.map((q) => q.visit_id));
    setPinnedIds(data.queue.filter((q) => q.pinned).map((q) => q.visit_id));
  }, [data.queue]);

  const rationaleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of data.queue) if (q.rationale) map[q.visit_id] = q.rationale;
    return map;
  }, [data.queue]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return data.visits.filter((v) => {
      if (filters.activeOnly && v.status === "COMPLETED") return false;
      if (filters.urgency !== ANY && v.urgency_level !== filters.urgency) return false;
      if (filters.encounterType !== ANY && v.encounter_type !== filters.encounterType) return false;
      if (filters.from && new Date(v.visit_date) < new Date(filters.from)) return false;
      if (filters.to && new Date(v.visit_date) > new Date(`${filters.to}T23:59:59`)) return false;
      if (q) {
        const patient = v.patient as { full_name?: string; cpr_number?: string } | null;
        const hay = [patient?.full_name, patient?.cpr_number, v.symptoms, v.conclusion]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.visits, filters]);

  const visits = useMemo(() => {
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...filtered].sort((a, b) => {
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime();
    });
  }, [filtered, order]);


  const activeChips = useMemo(() => {
    const chips: { key: keyof Filters; label: string }[] = [];
    if (filters.activeOnly) chips.push({ key: "activeOnly", label: "Active only" });
    if (filters.urgency !== ANY)
      chips.push({ key: "urgency", label: `Urgency: ${URGENCY_LABEL[filters.urgency]}` });
    if (filters.encounterType !== ANY)
      chips.push({
        key: "encounterType",
        label: `Type: ${ENCOUNTER_TYPE_LABEL[filters.encounterType]}`,
      });
    if (filters.from) chips.push({ key: "from", label: `From ${filters.from}` });
    if (filters.to) chips.push({ key: "to", label: `To ${filters.to}` });
    return chips;
  }, [filters]);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearChip(key: keyof Filters) {
    if (key === "activeOnly") return set("activeOnly", false);
    set(key, (key === "from" || key === "to" ? "" : ANY) as Filters[typeof key]);
  }

  const selected = useMemo(
    () => visits.find((v) => v.id === selectedId) ?? null,
    [visits, selectedId],
  );


  const [conclusion, setConclusion] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [disposition, setDisposition] = useState("HOME_CARE");
  const [urgency, setUrgency] = useState("LOW");

  function select(v: QueueVisit) {
    setSelectedId(v.id);
    setConclusion(v.conclusion ?? "");
    setRecommendation(v.recommendation ?? "");
    setDisposition(v.disposition ?? "HOME_CARE");
    setUrgency(v.urgency_level ?? "LOW");
    if (v.status === "IN_PROGRESS" && !v.taken_in_at) {
      takeIn({ data: { visitId: v.id } }).catch(() => undefined);
    }
  }

  const takeIn = useServerFn(markVisitTakenIn);
  const persistOrder = useServerFn(saveQueueOrder);
  const runTriage = useServerFn(prioritizeQueue);

  function persist(nextOrder: string[], nextPinned: string[]) {
    persistOrder({
      data: {
        items: nextOrder.map((visitId, index) => ({
          visitId,
          position: index,
          pinned: nextPinned.includes(visitId),
        })),
      },
    }).catch(() => toast.error("Could not save the queue order"));
  }

  function currentOrder() {
    const ids = visits.map((v) => v.id);
    for (const id of order) if (!ids.includes(id)) ids.push(id);
    return ids;
  }

  function togglePin(visitId: string) {
    const next = pinnedIds.includes(visitId)
      ? pinnedIds.filter((id) => id !== visitId)
      : [...pinnedIds, visitId];
    setPinnedIds(next);
    const ids = currentOrder();
    setOrder(ids);
    persist(ids, next);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = currentOrder().filter((id) => id !== dragId);
    const at = ids.indexOf(targetId);
    ids.splice(at < 0 ? ids.length : at, 0, dragId);
    setOrder(ids);
    setDragId(null);
    persist(ids, pinnedIds);
  }

  const triage = useMutation({
    mutationFn: async () => runTriage({ data: undefined }),
    onSuccess: (res) => {
      toast.success(
        res?.source === "agent"
          ? "Queue prioritised by the triage agent"
          : "Queue prioritised by urgency and waiting time",
      );
      queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
    },
    onError: () => toast.error("Could not prioritise the queue"),
  });


  const signOff = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await finalise({
        data: {
          visitId: selected.id,
          conclusion,
          recommendation,
          disposition: disposition as "HOME_CARE" | "PRESCRIPTION" | "ER_REFERRAL",
          urgencyLevel: urgency as "LOW" | "MEDIUM" | "HIGH_RED_FLAG",
        },
      });
    },
    onSuccess: () => {
      toast.success("Consultation signed off");
      queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
    },
    onError: () => toast.error("Could not save the consultation"),
  });

  const emergency = useMutation({
    mutationFn: async () => {
      if (!selected?.patient_id) return;
      await glass({ data: { patientId: selected.patient_id, justification } });
    },
    onSuccess: () => {
      toast.success("Emergency access granted and logged");
      setGlassOpen(false);
      setJustification("");
      queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
    },
    onError: () => toast.error("Justification must be at least 20 characters"),
  });

  return (
    <AppShell
      title="Consultation console"
      subtitle={`${visits.length} of ${data.visits.length} visits · ${data.consents.filter((c) => c.status === "ACTIVE").length} active consents`}
    >
      <RegisterVisit />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search patient, CPR, symptoms…"
            className="pl-9"
          />
        </div>

        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline">
              <Filter className="size-4" />
              Filters
              {activeChips.length > 0 ? (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeChips.length}
                </span>
              ) : null}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="mx-auto w-full max-w-2xl">
              <DrawerHeader>
                <DrawerTitle>Filter queue</DrawerTitle>
                <DrawerDescription>Narrow the queue to the consultations you need.</DrawerDescription>
              </DrawerHeader>

              <div className="grid gap-4 px-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
                  <div>
                    <Label htmlFor="active-only">Active only</Label>
                    <p className="text-xs text-muted-foreground">
                      Hide completed consultations.
                    </p>
                  </div>
                  <Switch
                    id="active-only"
                    checked={filters.activeOnly}
                    onCheckedChange={(v) => set("activeOnly", v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Picker
                    value={filters.urgency}
                    onChange={(v) => set("urgency", v)}
                    placeholder="Any urgency"
                    options={Object.entries(URGENCY_LABEL)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Encounter type</Label>
                  <Picker
                    value={filters.encounterType}
                    onChange={(v) => set("encounterType", v)}
                    placeholder="Any type"
                    options={Object.entries(ENCOUNTER_TYPE_LABEL)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Date range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={filters.from}
                      onChange={(e) => set("from", e.target.value)}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="date"
                      value={filters.to}
                      onChange={(e) => set("to", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DrawerFooter className="flex-row justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS, q: filters.q })}
                >
                  Reset
                </Button>
                <DrawerClose asChild>
                  <Button>Show {visits.length} visits</Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {activeChips.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => clearChip(chip.key)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground transition-colors hover:bg-accent"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="gap-2 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Patient queue</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto h-7 gap-1 text-xs"
                disabled={triage.isPending || visits.length < 2}
                onClick={() => triage.mutate()}
              >
                <Wand2 className="size-3.5" />
                {triage.isPending ? "Prioritising…" : "Prioritise"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag to reorder · pin to lock a position
            </p>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto p-0">
            {visits.map((v, index) => {
              const patient = v.patient as { full_name?: string; cpr_number?: string } | null;
              const isPinned = pinnedIds.includes(v.id);
              const waited = Math.max(
                0,
                Math.round(
                  (Date.now() - new Date(v.arrived_at ?? v.visit_date).getTime()) / 60000,
                ),
              );
              return (
                <motion.div
                  key={v.id}
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
                  draggable
                  onDragStart={() => setDragId(v.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => dragId && dragId !== v.id && previewMove(v.id)}
                  onDrop={() => commitOrder()}
                  onDragEnd={() => commitOrder()}
                  className={`flex items-start gap-2 border-b border-border px-3 py-3 transition-colors hover:bg-muted ${
                    selectedId === v.id ? "bg-accent" : ""
                  } ${dragId === v.id ? "opacity-60 ring-1 ring-primary/40" : ""}`}
                >
                  <span className="pt-1 text-[10px] font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => select(v)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {patient?.full_name ?? "Unknown patient"}
                      </span>
                      <span className="ml-auto shrink-0">
                        <UrgencyBadge level={v.urgency_level} />
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {formatCpr(patient?.cpr_number)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(v.visit_date)} ·{" "}
                      {ENCOUNTER_TYPE_LABEL[v.encounter_type ?? ""] ?? "Visit"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Waiting {waited < 60 ? `${waited} min` : `${Math.floor(waited / 60)} h ${waited % 60} min`}
                    </p>
                    {rationaleById[v.id] && !isPinned ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        {rationaleById[v.id]}
                      </p>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <button
                      type="button"
                      aria-label={isPinned ? "Unpin from position" : "Pin position"}
                      onClick={() => togglePin(v.id)}
                      className={`rounded-md p-1 transition-colors hover:bg-accent ${
                        isPinned ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {isPinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
                    </button>
                    <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                  </div>
                </motion.div>
              );
            })}
            {visits.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {data.visits.length === 0
                  ? "No visits visible. Access requires an active consent grant."
                  : "No visits match these filters."}
              </p>
            ) : null}
          </CardContent>
        </Card>


        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4" />
                  AI visit summary
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setGlassOpen(true)}>
                  <ShieldAlert className="size-4" />
                  Break glass
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Block label="Symptoms" value={selected.symptoms} />

                <div className="space-y-2">
                  <Label htmlFor="conclusion">Conclusion</Label>
                  <Textarea
                    id="conclusion"
                    rows={3}
                    value={conclusion}
                    onChange={(e) => setConclusion(e.target.value)}
                    placeholder="Clinical conclusion…"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendation">Recommendation</Label>
                  <Textarea
                    id="recommendation"
                    rows={3}
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="Plan and follow-up…"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH_RED_FLAG">Red flag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Disposition</Label>
                    <Select value={disposition} onValueChange={setDisposition}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOME_CARE">Home care</SelectItem>
                        <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
                        <SelectItem value="ER_REFERRAL">ER referral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={() => signOff.mutate()} disabled={signOff.isPending}>
                  Sign off consultation
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Coding</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {codesOf(selected.symptom_icd_codes).length ? (
                  codesOf(selected.symptom_icd_codes).map((c) => (
                    <CodeChip key={c} code={c} system="ICD-10" />
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No codes extracted yet — coding runs on transcript processing.
                  </span>
                )}
                <DispositionBadge value={selected.disposition} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              Select a patient from the queue to open their consultation.
            </CardContent>
          </Card>
        )}
      </div>

      <Drawer open={glassOpen} onOpenChange={setGlassOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle>Emergency access</DrawerTitle>
              <DrawerDescription>
                Break-glass access is logged against your licence and expires after 24 hours. A
                justification of at least 20 characters is mandatory.
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
                onClick={() => emergency.mutate()}
                disabled={emergency.isPending}
              >
                Confirm emergency access
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </AppShell>
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
      <Card className="mb-4 border-primary/30 bg-primary/[0.04]">
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

function Picker({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}</SelectItem>
        {options.map(([val, label]) => (
          <SelectItem key={val} value={val}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function codesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function Block({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "Not recorded"}</p>
    </div>
  );
}
