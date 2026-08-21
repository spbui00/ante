import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Info, Pin, PinOff, X } from "lucide-react";

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

export type CardSeries = {
  key: string;
  label?: string | null;
  color?: string | null;
  /** Overlay only: how this series is drawn. */
  type?: "line" | "bar" | "area" | null;
  /** Overlay only: which y-axis it uses (use "right" for different units/scales). */
  axis?: "left" | "right" | null;
};
export type CardColumn = { key: string; label?: string | null };

export type CardConfig = {
  xKey?: string | null;
  valueKey?: string | null;
  unit?: string | null;
  severity?: "critical" | "warning" | "info" | null;
  text?: string | null;
  series?: CardSeries[] | null;
  columns?: CardColumn[] | null;
};

export type AnalyticsCardData = {
  id: string;
  title: string;
  subtitle?: string | null;
  kind: string;
  sql?: string | null;
  config: CardConfig;
  windowDays?: number;
  pinned?: boolean;
  rows: Record<string, unknown>[];
  error?: string | null;
};

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function labelise(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function seriesOf(card: AnalyticsCardData): CardSeries[] {
  const configured = card.config?.series;
  if (Array.isArray(configured) && configured.length) return configured;
  const xKey = card.config?.xKey;
  const first = card.rows[0] ?? {};
  return Object.keys(first)
    .filter((k) => k !== xKey && typeof first[k] === "number")
    .slice(0, 4)
    .map((k) => ({ key: k }));
}

function columnsOf(card: AnalyticsCardData): CardColumn[] {
  const configured = card.config?.columns;
  if (Array.isArray(configured) && configured.length) return configured;
  return Object.keys(card.rows[0] ?? {})
    .slice(0, 6)
    .map((k) => ({ key: k }));
}


function CardChrome({
  card,
  onPin,
  onRemove,
  children,
  className,
}: {
  card: AnalyticsCardData;
  onPin?: ((card: AnalyticsCardData) => void) | undefined;
  onRemove?: ((card: AnalyticsCardData) => void) | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start gap-2 space-y-0 pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm leading-snug">{card.title}</CardTitle>
          {card.subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onPin ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              title={card.pinned ? "Unpin" : "Pin this card"}
              onClick={() => onPin(card)}
            >
              {card.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </Button>
          ) : null}
          {onRemove ? (
            <Button size="icon" variant="ghost" className="size-7" title="Remove" onClick={() => onRemove(card)}>
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export function AnalyticsCardView({
  card,
  onPin,
  onRemove,
}: {
  card: AnalyticsCardData;
  onPin?: ((card: AnalyticsCardData) => void) | undefined;
  onRemove?: ((card: AnalyticsCardData) => void) | undefined;
}) {
  if (card.kind === "alert") {
    const severity = (card.config?.severity ?? "info") as "critical" | "warning" | "info";
    return (
      <Card
        className={
          severity === "critical"
            ? "border-destructive/50 bg-destructive/[0.04]"
            : severity === "warning"
              ? "border-primary/40 bg-primary/[0.04]"
              : ""
        }
      >
        <CardContent className="flex gap-3 p-4">
          {severity === "info" ? (
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <AlertTriangle
              className={`mt-0.5 size-4 shrink-0 ${severity === "critical" ? "text-destructive" : "text-primary"}`}
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{card.title}</p>
            {card.config?.text ? (
              <p className="mt-1 text-xs text-muted-foreground">{card.config.text}</p>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-start gap-1">
            <Badge variant={severity === "critical" ? "destructive" : "secondary"} className="h-fit capitalize">
              {severity}
            </Badge>
            {onPin ? (
              <Button size="icon" variant="ghost" className="size-7" onClick={() => onPin(card)}>
                {card.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </Button>
            ) : null}
            {onRemove ? (
              <Button size="icon" variant="ghost" className="size-7" onClick={() => onRemove(card)}>
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (card.error) {
    return (
      <CardChrome card={card} onPin={onPin} onRemove={onRemove}>
        <p className="text-xs text-muted-foreground">This card&apos;s query could not be run.</p>
      </CardChrome>
    );
  }

  if (card.kind === "metric") {
    const valueKey = card.config?.valueKey ?? Object.keys(card.rows[0] ?? {})[0] ?? "value";
    const raw = card.rows[0]?.[valueKey];
    const value = typeof raw === "number" ? raw.toLocaleString() : String(raw ?? "—");
    return (
      <CardChrome card={card} onPin={onPin} onRemove={onRemove}>
        <p className="text-3xl font-semibold text-foreground">
          {value}
          {card.config?.unit ? (
            <span className="ml-1 text-sm font-normal text-muted-foreground">{card.config.unit}</span>
          ) : null}
        </p>
      </CardChrome>
    );
  }

  if (card.kind === "table") {
    const columns = columnsOf(card);
    return (
      <CardChrome card={card} onPin={onPin} onRemove={onRemove}>
        <div className="max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label ?? labelise(c.key)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {card.rows.map((r, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="whitespace-nowrap text-sm">
                      {typeof r[c.key] === "number"
                        ? (r[c.key] as number).toLocaleString()
                        : String(r[c.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardChrome>
    );
  }

  const xKey = card.config?.xKey ?? Object.keys(card.rows[0] ?? {})[0] ?? "x";
  const series = seriesOf(card);
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} minTickGap={24} />
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
    </>
  );

  return (
    <CardChrome card={card} onPin={onPin} onRemove={onRemove}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {card.kind === "bar" ? (
            <BarChart data={card.rows} margin={{ left: -20, right: 8 }}>
              {axes}
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label ?? labelise(s.key)} fill={s.color ?? PALETTE[i % PALETTE.length]} />
              ))}
            </BarChart>
          ) : card.kind === "area" ? (
            <AreaChart data={card.rows} margin={{ left: -20, right: 8 }}>
              {axes}
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label ?? labelise(s.key)}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  fill={s.color ?? PALETTE[i % PALETTE.length]}
                  fillOpacity={0.18}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={card.rows} margin={{ left: -20, right: 8 }}>
              {axes}
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label ?? labelise(s.key)}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </CardChrome>
  );
}
