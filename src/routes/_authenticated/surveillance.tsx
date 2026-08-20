import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/ante/app-shell";
import { UrgencyBadge } from "@/components/ante/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSurveillance } from "@/lib/ante.functions";
import { AGE_BRACKETS, formatDate } from "@/lib/clinical-utils";

const surveillanceQuery = (days: number) =>
  queryOptions({
    queryKey: ["surveillance", days],
    queryFn: () => getSurveillance({ data: { days } }),
  });

export const Route = createFileRoute("/_authenticated/surveillance")({
  head: () => ({
    meta: [
      { title: "Epidemiological Command Centre — Ante" },
      {
        name: "description",
        content:
          "Real-time anonymised surveillance: symptom spikes by postal code, urgency trends and disposition mix across the population.",
      },
      { property: "og:title", content: "Epidemiological Command Centre — Ante" },
      {
        property: "og:description",
        content: "Live anonymised population signal from coded consultations.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(surveillanceQuery(90)),
  errorComponent: () => (
    <AppShell title="Surveillance">
      <p className="text-sm text-muted-foreground">
        Could not load surveillance data. Please try again.
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Surveillance">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: SurveillancePage,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function SurveillancePage() {
  const [days, setDays] = useState(90);
  const [postal, setPostal] = useState("all");
  const [bracket, setBracket] = useState("all");

  const { data } = useSuspenseQuery(surveillanceQuery(days));

  const rows = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (postal === "all" || r.postal_code === postal) &&
          (bracket === "all" || r.age_bracket === bracket),
      ),
    [data.rows, postal, bracket],
  );

  const postalCodes = useMemo(
    () => [...new Set(data.rows.map((r) => r.postal_code).filter(Boolean))].sort() as string[],
    [data.rows],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.encounter_date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [rows]);

  const byPostal = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!r.postal_code) continue;
      map.set(r.postal_code, (map.get(r.postal_code) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [rows]);

  const byCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const codes = Array.isArray(r.symptom_icd_codes)
        ? (r.symptom_icd_codes as unknown[]).filter((c): c is string => typeof c === "string")
        : [];
      for (const c of codes) map.set(c, (map.get(c) ?? 0) + 1);
      if (r.primary_icd_10) map.set(r.primary_icd_10, (map.get(r.primary_icd_10) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows]);

  const byDisposition = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.disposition ?? "UNKNOWN";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const redFlags = rows.filter((r) => r.urgency_level === "HIGH_RED_FLAG").length;

  return (
    <AppShell
      title="Epidemiological command centre"
      subtitle={`${rows.length} anonymised encounters since ${formatDate(data.since)}`}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
        <Filter label="Window">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </Filter>
        <Filter label="Postal code">
          <Select value={postal} onValueChange={setPostal}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {postalCodes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filter>
        <Filter label="Age bracket">
          <Select value={bracket} onValueChange={setBracket}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ages</SelectItem>
              {AGE_BRACKETS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filter>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Encounters" value={rows.length} />
        <Stat label="Red-flag cases" value={redFlags} />
        <Stat label="Active postal areas" value={postalCodes.length} />
        <Stat
          label="ER referrals"
          value={rows.filter((r) => r.disposition === "ER_REFERRAL").length}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Encounter volume over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Symptom spikes by postal code">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byPostal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="code" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top coded presentations">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCode} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
              <YAxis type="category" dataKey="code" width={70} fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip />
              <Bar dataKey="count" fill="var(--chart-3)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Disposition mix">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byDisposition} dataKey="value" nameKey="name" outerRadius={90} label>
                {byDisposition.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Anonymised encounter feed</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[480px] overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Postal</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Primary code</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Urgency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 200).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.encounter_date)}</TableCell>
                  <TableCell>{r.postal_code ?? "—"}</TableCell>
                  <TableCell>{r.age_bracket ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.primary_icd_10 ?? "—"}</TableCell>
                  <TableCell>{r.symptom_duration_category ?? "—"}</TableCell>
                  <TableCell>
                    <UrgencyBadge level={r.urgency_level} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
