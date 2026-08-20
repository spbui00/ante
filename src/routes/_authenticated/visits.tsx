import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Filter, Search, X } from "lucide-react";

import { AppShell } from "@/components/ante/app-shell";
import { DispositionBadge, UrgencyBadge } from "@/components/ante/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichText } from "@/components/ante/rich-text";
import { VisitCard } from "@/components/ante/visit-card";
import { getMyVisitHistory } from "@/lib/ante.functions";
import { DISPOSITION_LABEL, ENCOUNTER_TYPE_LABEL, URGENCY_LABEL, formatDate } from "@/lib/clinical-utils";

const visitsQuery = queryOptions({
  queryKey: ["my-visit-history"],
  queryFn: () => getMyVisitHistory(),
});

type VisitItem = Awaited<ReturnType<typeof getMyVisitHistory>>["visits"][number];

export const Route = createFileRoute("/_authenticated/visits")({
  head: () => ({
    meta: [
      { title: "Visit History — Ante" },
      {
        name: "description",
        content:
          "Browse every consultation in your record and filter by urgency, date, clinician, disposition, status or encounter type.",
      },
      { property: "og:title", content: "Visit History — Ante" },
      {
        property: "og:description",
        content: "Every consultation in your record, filterable and searchable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(visitsQuery),
  errorComponent: () => (
    <AppShell title="Visit history">
      <p className="text-sm text-muted-foreground">Could not load your visit history.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Visit history">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: VisitsPage,
});

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

const ANY = "__any__";

type Filters = {
  q: string;
  urgency: string;
  status: string;
  encounterType: string;
  disposition: string;
  doctor: string;
  from: string;
  to: string;
};

const EMPTY: Filters = {
  q: "",
  urgency: ANY,
  status: ANY,
  encounterType: ANY,
  disposition: ANY,
  doctor: ANY,
  from: "",
  to: "",
};

function VisitsPage() {
  const { data } = useSuspenseQuery(visitsQuery);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const doctors = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of data.visits) {
      const p = (v as { practitioner?: { id: string; full_name: string; title?: string | null } })
        .practitioner;
      if (p?.id) map.set(p.id, [p.title, p.full_name].filter(Boolean).join(" "));
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.visits]);

  const visits = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return data.visits.filter((v) => {
      if (filters.urgency !== ANY && v.urgency_level !== filters.urgency) return false;
      if (filters.status !== ANY && v.status !== filters.status) return false;
      if (filters.encounterType !== ANY && v.encounter_type !== filters.encounterType) return false;
      if (filters.disposition !== ANY && v.disposition !== filters.disposition) return false;
      if (filters.doctor !== ANY && v.practitioner_id !== filters.doctor) return false;
      if (filters.from && new Date(v.visit_date) < new Date(filters.from)) return false;
      if (filters.to && new Date(v.visit_date) > new Date(`${filters.to}T23:59:59`)) return false;
      if (q) {
        const hay = [
          v.conclusion,
          v.recommendation,
          v.symptoms,
          (v as { practitioner?: { full_name?: string } }).practitioner?.full_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.visits, filters]);

  const activeChips = useMemo(() => {
    const chips: { key: keyof Filters; label: string }[] = [];
    if (filters.urgency !== ANY)
      chips.push({ key: "urgency", label: `Urgency: ${URGENCY_LABEL[filters.urgency]}` });
    if (filters.status !== ANY)
      chips.push({ key: "status", label: `Status: ${STATUS_LABEL[filters.status]}` });
    if (filters.encounterType !== ANY)
      chips.push({ key: "encounterType", label: `Type: ${ENCOUNTER_TYPE_LABEL[filters.encounterType]}` });
    if (filters.disposition !== ANY)
      chips.push({ key: "disposition", label: `Disposition: ${DISPOSITION_LABEL[filters.disposition]}` });
    if (filters.doctor !== ANY)
      chips.push({
        key: "doctor",
        label: `Clinician: ${doctors.find(([id]) => id === filters.doctor)?.[1] ?? "—"}`,
      });
    if (filters.from) chips.push({ key: "from", label: `From ${filters.from}` });
    if (filters.to) chips.push({ key: "to", label: `To ${filters.to}` });
    return chips;
  }, [filters, doctors]);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearChip(key: keyof Filters) {
    set(key, (key === "from" || key === "to" ? "" : ANY) as Filters[typeof key]);
  }

  return (
    <AppShell
      title="Visit history"
      subtitle={`${visits.length} of ${data.visits.length} consultations`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search conclusions, symptoms, clinicians…"
            className="pl-9"
          />
        </div>

        <Drawer open={open} onOpenChange={setOpen}>
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
                <DrawerTitle>Filter visits</DrawerTitle>
                <DrawerDescription>Narrow your history down to what matters.</DrawerDescription>
              </DrawerHeader>

              <div className="grid gap-4 px-4 sm:grid-cols-2">
                <Field label="Urgency">
                  <Picker
                    value={filters.urgency}
                    onChange={(v) => set("urgency", v)}
                    placeholder="Any urgency"
                    options={Object.entries(URGENCY_LABEL)}
                  />
                </Field>
                <Field label="Status">
                  <Picker
                    value={filters.status}
                    onChange={(v) => set("status", v)}
                    placeholder="Any status"
                    options={Object.entries(STATUS_LABEL)}
                  />
                </Field>
                <Field label="Encounter type">
                  <Picker
                    value={filters.encounterType}
                    onChange={(v) => set("encounterType", v)}
                    placeholder="Any type"
                    options={Object.entries(ENCOUNTER_TYPE_LABEL)}
                  />
                </Field>
                <Field label="Disposition">
                  <Picker
                    value={filters.disposition}
                    onChange={(v) => set("disposition", v)}
                    placeholder="Any disposition"
                    options={Object.entries(DISPOSITION_LABEL)}
                  />
                </Field>
                <Field label="Clinician">
                  <Picker
                    value={filters.doctor}
                    onChange={(v) => set("doctor", v)}
                    placeholder="Any clinician"
                    options={doctors}
                  />
                </Field>
                <Field label="Date range">
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
                </Field>
              </div>

              <DrawerFooter className="flex-row justify-end gap-2">
                <Button variant="ghost" onClick={() => setFilters({ ...EMPTY, q: filters.q })}>
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

      <div className="grid gap-3">
        {visits.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No visits match these filters.
          </p>
        ) : null}

        {visits.map((v) => (
          <VisitCard
            key={v.id}
            visit={v as VisitItem}
            onClick={() => {
              setSelectedVisit(v as VisitItem);
              setDetailOpen(true);
            }}
          />
        ))}
      </div>

      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-2xl">
            <DrawerHeader>
              <DrawerTitle>Visit details</DrawerTitle>
              <DrawerDescription>
                {selectedVisit ? formatDate(selectedVisit.visit_date) : "—"}
              </DrawerDescription>
            </DrawerHeader>

            {selectedVisit ? (
              <div className="space-y-6 overflow-y-auto px-4 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedVisit.encounter_type ? (
                    <Badge variant="outline">{ENCOUNTER_TYPE_LABEL[selectedVisit.encounter_type] ?? selectedVisit.encounter_type}</Badge>
                  ) : null}
                  <UrgencyBadge level={selectedVisit.urgency_level} />
                  {selectedVisit.status ? (
                    <Badge variant="secondary">{STATUS_LABEL[selectedVisit.status] ?? selectedVisit.status}</Badge>
                  ) : null}
                  <DispositionBadge value={selectedVisit.disposition} />
                </div>

                <DetailSection
                  label="Clinician"
                  value={(() => {
                    const p = selectedVisit.practitioner;
                    if (!p?.full_name) return "—";
                    return [
                      [p.title, p.full_name].filter(Boolean).join(" "),
                      p.specialization,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                  })()}
                />

                <DetailSection label="Symptoms" value={selectedVisit.symptoms ?? "No symptoms recorded."} />
                <DetailSection label="Conclusion" value={selectedVisit.conclusion ?? "No conclusion recorded."} />
                <DetailSection label="Recommendation" value={selectedVisit.recommendation ?? "No recommendation recorded."} />
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Select a visit to view details.</div>
            )}

            <DrawerFooter className="flex-row justify-end">
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
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
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h4>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}
