import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Brain, Info, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutbreakAnalystDrawer } from "@/components/ante/outbreak-analyst-drawer";
import { getOutbreakIntelligence } from "@/lib/outbreak.functions";

function pct(v: number) {
  const rounded = Math.round(v * 100);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function OutbreakPanel({ days = 180 }: { days?: number }) {
  const [chatOpen, setChatOpen] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["outbreak-intelligence", days],
    queryFn: () => getOutbreakIntelligence({ data: { days } }),
    staleTime: 5 * 60_000,
  });

  if (isPending) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Computing outbreak signals…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Outbreak intelligence is unavailable for this account.
        </CardContent>
      </Card>
    );
  }

  const headline = data.metrics.filter((m) =>
    ["total", "covid", "respiratory", "er"].includes(m.key),
  );

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Outbreak intelligence</h2>
          <p className="text-xs text-muted-foreground">
            {data.total.toLocaleString()} de-identified encounters analysed · 7-day moving averages
          </p>
        </div>
        <Button className="gap-2" onClick={() => setChatOpen(true)}>
          <Brain className="size-4" />
          Ask the epidemiologist
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {headline.map((m) => {
          const up = m.growth > 0;
          return (
            <Card key={m.key}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {m.last7.toLocaleString()}
                </p>
                <p
                  className={`mt-1 flex items-center gap-1 text-xs ${
                    up ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {pct(m.growth)} vs last week
                </p>
                {m.doublingDays ? (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Doubling every {m.doublingDays.toFixed(1)} days
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {data.anomalies.map((a) => (
          <Card
            key={a.id}
            className={
              a.severity === "critical"
                ? "border-destructive/50 bg-destructive/[0.04]"
                : a.severity === "warning"
                  ? "border-primary/40 bg-primary/[0.04]"
                  : ""
            }
          >
            <CardContent className="flex gap-3 p-4">
              {a.severity === "info" ? (
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${
                    a.severity === "critical" ? "text-destructive" : "text-primary"
                  }`}
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <Badge
                variant={a.severity === "critical" ? "destructive" : "secondary"}
                className="ml-auto h-fit shrink-0 capitalize"
              >
                {a.severity}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Epidemic curve</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                minTickGap={40}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="total"
                name="All encounters"
                stroke="var(--chart-2)"
                fill="var(--chart-2)"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="covid"
                name="COVID-19 coded"
                stroke="var(--destructive)"
                fill="var(--destructive)"
                fillOpacity={0.2}
              />
              <Line
                type="monotone"
                dataKey="covidAvg"
                name="COVID 7-day avg"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Weekly severity mix</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(v: string) => v.slice(5)}
                  minTickGap={20}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="covid" name="COVID-19" fill="var(--destructive)" />
                <Bar dataKey="redFlag" name="Red flag" fill="var(--chart-4)" />
                <Bar dataKey="er" name="ER referral" fill="var(--chart-3)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Geographic hotspots (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Postal</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                  <TableHead className="text-right">COVID</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.hotspots.map((h) => (
                  <TableRow key={h.postalCode}>
                    <TableCell className="font-medium">{h.postalCode}</TableCell>
                    <TableCell className="text-right">{h.recent}</TableCell>
                    <TableCell className="text-right">{h.recentCovid}</TableCell>
                    <TableCell
                      className={`text-right ${h.growth >= 0.5 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {pct(h.growth)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fastest-rising codes</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Last 14d</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.emergingCodes.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="text-right">{c.recent}</TableCell>
                    <TableCell className="text-right">{c.priorPer14}</TableCell>
                    <TableCell
                      className={`text-right ${c.growth >= 1 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {pct(c.growth)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Age mix (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ages} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="ageBracket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recent" name="All encounters" fill="var(--chart-2)" />
                <Bar dataKey="recentCovid" name="COVID-19" fill="var(--destructive)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <OutbreakAnalystDrawer open={chatOpen} onOpenChange={setChatOpen} days={days} />
    </div>
  );
}
