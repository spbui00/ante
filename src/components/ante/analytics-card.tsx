import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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
  const hasRightAxis = series.some((s) => s.axis === "right");
  const stacked = card.config?.stacked === true;
  const rows = card.rows;

  return (
    <CardChrome card={card} onPin={onPin} onRemove={onRemove}>
      <ChartBody
        card={card}
        rows={rows}
        xKey={xKey}
        series={series}
        hasRightAxis={hasRightAxis}
        stacked={stacked}
      />
    </CardChrome>
  );
}

function isDateLike(v: unknown) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function formatX(v: unknown) {
  if (isDateLike(v)) {
    const d = new Date(v as string);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }
  }
  const s = String(v ?? "");
  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
}

function formatNumber(v: unknown) {
  if (typeof v !== "number") return String(v ?? "—");
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`;
  if (abs >= 1000) return v.toLocaleString();
  if (!Number.isInteger(v)) return v.toFixed(abs < 10 ? 1 : 0);
  return String(v);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  const heading = isDateLike(label)
    ? new Date(label as string).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : String(label ?? "");
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-md backdrop-blur">
      <p className="mb-1 text-xs font-medium text-foreground">{heading}</p>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color ?? p.stroke ?? p.fill }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {typeof p.value === "number" ? p.value.toLocaleString() : String(p.value ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartBody({
  card,
  rows,
  xKey,
  series,
  hasRightAxis,
  stacked,
}: {
  card: AnalyticsCardData;
  rows: Record<string, unknown>[];
  xKey: string;
  series: CardSeries[];
  hasRightAxis: boolean;
  stacked: boolean;
}) {
  const [hidden, setHidden] = React.useState<Record<string, boolean>>({});
  const [focus, setFocus] = React.useState<string | null>(null);

  const visible = series.filter((s) => !hidden[s.key]);
  const axisIdOf = (s: CardSeries) => (s.axis === "right" && hasRightAxis ? "right" : "left");
  const opacityOf = (s: CardSeries) => (focus && focus !== s.key ? 0.22 : 1);
  const colorOf = (s: CardSeries, i: number) => s.color ?? PALETTE[i % PALETTE.length];
  const gradientId = (key: string) => `grad-${card.id}-${key}`.replace(/[^a-zA-Z0-9-]/g, "");
  const showBrush = rows.length > 45 && card.kind !== "bar";

  const defs = (
    <defs>
      {series.map((s, i) => {
        const color = colorOf(s, i);
        return (
          <linearGradient key={s.key} id={gradientId(s.key)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        );
      })}
    </defs>
  );

  const axes = (
    <>
      {defs}
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        tickFormatter={formatX}
        tickLine={false}
        axisLine={{ stroke: "var(--border)" }}
        minTickGap={20}
        height={28}
      />
      <YAxis
        yAxisId="left"
        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        tickFormatter={formatNumber}
        tickLine={false}
        axisLine={false}
        width={46}
        label={
          card.config?.yLabel
            ? {
                value: card.config.yLabel,
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "var(--muted-foreground)" },
              }
            : undefined
        }
      />
      {hasRightAxis ? (
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={formatNumber}
          tickLine={false}
          axisLine={false}
          width={46}
          label={
            card.config?.yRightLabel
              ? {
                  value: card.config.yRightLabel,
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 11, fill: "var(--muted-foreground)" },
                }
              : undefined
          }
        />
      ) : null}
      <Tooltip
        content={<ChartTooltip />}
        cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.35, strokeDasharray: "3 3" }}
      />
      <Legend
        wrapperStyle={{ fontSize: 11, cursor: "pointer", paddingTop: 4 }}
        onClick={(e: any) => {
          const key = String(e?.dataKey ?? e?.value ?? "");
          setHidden((h) => ({ ...h, [key]: !h[key] }));
        }}
        onMouseEnter={(e: any) => setFocus(String(e?.dataKey ?? ""))}
        onMouseLeave={() => setFocus(null)}
        formatter={(value: any, entry: any) => (
          <span
            style={{
              color: hidden[String(entry?.dataKey ?? "")]
                ? "var(--muted-foreground)"
                : "var(--foreground)",
              textDecoration: hidden[String(entry?.dataKey ?? "")] ? "line-through" : "none",
            }}
          >
            {value}
          </span>
        )}
      />
      {showBrush ? (
        <Brush
          dataKey={xKey}
          height={20}
          travellerWidth={8}
          stroke="var(--border)"
          fill="var(--muted)"
          tickFormatter={formatX as any}
        />
      ) : null}
    </>
  );

  const margin = { top: 8, left: 4, right: hasRightAxis ? 4 : 12, bottom: 0 };

  const renderSeries = (s: CardSeries, i: number, fallback: "line" | "area" | "bar") => {
    const kind = s.type ?? fallback;
    const color = colorOf(s, i);
    const name = s.label ?? labelise(s.key);
    const common = {
      key: s.key,
      yAxisId: axisIdOf(s),
      dataKey: s.key,
      name,
      opacity: opacityOf(s),
      onMouseEnter: () => setFocus(s.key),
      onMouseLeave: () => setFocus(null),
    } as const;
    if (kind === "bar") {
      return (
        <Bar
          {...common}
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          stackId={stacked ? "a" : undefined}
        />
      );
    }
    if (kind === "area") {
      return (
        <Area
          {...common}
          type="monotone"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId(s.key)})`}
          activeDot={{ r: 4, strokeWidth: 0 }}
          stackId={stacked ? "a" : undefined}
        />
      );
    }
    return (
      <Line
        {...common}
        type="monotone"
        stroke={color}
        strokeWidth={2}
        dot={rows.length <= 20 ? { r: 2.5, strokeWidth: 0, fill: color } : false}
        activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
      />
    );
  };

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        {card.kind === "combo" ? (
          <ComposedChart data={rows} margin={margin}>
            {axes}
            {visible.map((s) => renderSeries(s, series.indexOf(s), "line"))}
          </ComposedChart>
        ) : card.kind === "bar" ? (
          <BarChart data={rows} margin={margin}>
            {axes}
            {visible.map((s) => renderSeries(s, series.indexOf(s), "bar"))}
          </BarChart>
        ) : card.kind === "area" ? (
          <AreaChart data={rows} margin={margin}>
            {axes}
            {visible.map((s) => renderSeries(s, series.indexOf(s), "area"))}
          </AreaChart>
        ) : (
          <LineChart data={rows} margin={margin}>
            {axes}
            {visible.map((s) => renderSeries(s, series.indexOf(s), "line"))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

