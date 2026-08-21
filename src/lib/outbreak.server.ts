/**
 * Outbreak intelligence: turns the raw aggregation returned by the
 * `outbreak_stats` SQL function into epidemiological signals (moving averages,
 * week-over-week growth, doubling time, hotspots, emerging codes, anomalies).
 *
 * Server-only helper: pure computation, no secrets, no client imports.
 */

export type DailyRow = {
  d: string;
  total: number;
  focus: number;
  respiratory: number;
  gastro: number;
  febrile: number;
  red_flag: number;
  er: number;
};

export type WeeklyRow = { w: string; total: number; focus: number; red_flag: number; er: number };
export type PostalRow = {
  postal_code: string;
  recent: number;
  prior: number;
  recent_focus: number;
};
export type CodeRow = { code: string; recent: number; prior: number };
export type AgeRow = {
  age_bracket: string;
  recent: number;
  prior: number;
  recent_focus: number;
};

export type OutbreakStats = {
  since: string;
  generatedAt: string;
  focusPrefixes?: string[];
  total: number;
  daily: DailyRow[];
  weekly: WeeklyRow[];
  postal: PostalRow[];
  codes: CodeRow[];
  ages: AgeRow[];
};

export type Anomaly = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

const SYNDROMES = ["respiratory", "gastro", "febrile"] as const;
export type Syndrome = (typeof SYNDROMES)[number] | "focus" | "total";

function movingAverage(values: number[], window: number) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function sumLast(rows: DailyRow[], key: keyof DailyRow, days: number, offset = 0) {
  const end = rows.length - offset;
  const slice = rows.slice(Math.max(0, end - days), Math.max(0, end));
  return slice.reduce((a, r) => a + Number(r[key] ?? 0), 0);
}

/** Doubling time in days from a growth ratio measured over `periodDays`. */
function doublingTime(current: number, previous: number, periodDays: number) {
  if (previous <= 0 || current <= previous) return null;
  const growth = Math.log(current / previous) / periodDays;
  if (growth <= 0) return null;
  return Math.log(2) / growth;
}

export type FocusMeta = { id: string; label: string; short: string; prefixes: string[] };

export function computeSignals(stats: OutbreakStats, focus: FocusMeta) {
  const daily = [...(stats.daily ?? [])].sort((a, b) => a.d.localeCompare(b.d));

  const series = daily.map((r, i, arr) => ({
    date: r.d,
    total: Number(r.total),
    focus: Number(r.focus),
    respiratory: Number(r.respiratory),
    gastro: Number(r.gastro),
    febrile: Number(r.febrile),
    redFlag: Number(r.red_flag),
    er: Number(r.er),
    totalAvg: 0,
    focusAvg: 0,
    respiratoryAvg: 0,
    _i: i,
    _n: arr.length,
  }));

  const totalAvg = movingAverage(series.map((s) => s.total), 7);
  const focusAvg = movingAverage(series.map((s) => s.focus), 7);
  const respAvg = movingAverage(series.map((s) => s.respiratory), 7);
  series.forEach((s, i) => {
    s.totalAvg = Number((totalAvg[i] ?? 0).toFixed(1));
    s.focusAvg = Number((focusAvg[i] ?? 0).toFixed(1));
    s.respiratoryAvg = Number((respAvg[i] ?? 0).toFixed(1));
  });

  function metric(key: keyof DailyRow, label: string) {
    const last7 = sumLast(daily, key, 7);
    const prev7 = sumLast(daily, key, 7, 7);
    const prev14 = sumLast(daily, key, 14, 14);
    const growth = prev7 > 0 ? (last7 - prev7) / prev7 : last7 > 0 ? 1 : 0;
    return {
      key: String(key),
      label,
      last7,
      prev7,
      prev14,
      growth,
      doublingDays: doublingTime(last7, prev7, 7),
    };
  }

  const metrics = [
    metric("total", "All encounters"),
    metric("focus", focus.label),
    metric("respiratory", "Respiratory syndrome"),
    metric("gastro", "Gastrointestinal syndrome"),
    metric("febrile", "Febrile illness"),
    metric("er", "ER referrals"),
    metric("red_flag", "Red-flag urgency"),
  ];

  const hotspots = (stats.postal ?? [])
    .map((p) => {
      const recent = Number(p.recent);
      const prior = Number(p.prior);
      return {
        postalCode: p.postal_code,
        recent,
        prior,
        recentFocus: Number(p.recent_focus),
        growth: prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0,
      };
    })
    .sort((a, b) => b.recentFocus - a.recentFocus || b.growth - a.growth)
    .slice(0, 12);

  const emergingCodes = (stats.codes ?? [])
    .map((c) => {
      const recent = Number(c.recent);
      // `prior` covers the 28 days before the recent 14-day window.
      const priorPer14 = Number(c.prior) / 2;
      return {
        code: c.code,
        recent,
        priorPer14: Number(priorPer14.toFixed(1)),
        growth: priorPer14 > 0 ? (recent - priorPer14) / priorPer14 : recent > 0 ? 1 : 0,
      };
    })
    .filter((c) => c.recent >= 5)
    .sort((a, b) => b.growth - a.growth || b.recent - a.recent)
    .slice(0, 10);

  const ages = (stats.ages ?? [])
    .map((a) => ({
      ageBracket: a.age_bracket,
      recent: Number(a.recent),
      prior: Number(a.prior),
      recentFocus: Number(a.recent_focus),
      growth: Number(a.prior) > 0 ? (Number(a.recent) - Number(a.prior)) / Number(a.prior) : 0,
    }))
    .filter((a) => a.recent > 0)
    .sort((a, b) => b.recent - a.recent);

  const focusMetric = metrics.find((m) => m.key === "focus")!;
  const resp = metrics.find((m) => m.key === "respiratory")!;
  const er = metrics.find((m) => m.key === "er")!;

  const anomalies: Anomaly[] = [];
  const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

  if (focusMetric.last7 > 0 && focusMetric.growth >= 0.5) {
    anomalies.push({
      id: "focus-growth",
      severity: focusMetric.growth >= 1 ? "critical" : "warning",
      title: `${focus.short} encounters ${pct(focusMetric.growth)} week over week`,
      detail: `${focusMetric.last7} encounters coded ${focus.prefixes.join("/")}* in the last 7 days versus ${focusMetric.prev7} the week before${
        focusMetric.doublingDays
          ? `, doubling roughly every ${focusMetric.doublingDays.toFixed(1)} days`
          : ""
      }.`,
    });
  }
  if (resp.growth >= 0.3 && resp.last7 >= 20) {
    anomalies.push({
      id: "resp-growth",
      severity: resp.growth >= 0.75 ? "critical" : "warning",
      title: `Respiratory syndrome up ${pct(resp.growth)}`,
      detail: `${resp.last7} respiratory presentations this week (${resp.prev7} last week). Watch for capacity strain in primary care.`,
    });
  }
  if (er.growth >= 0.3 && er.last7 >= 10) {
    anomalies.push({
      id: "er-growth",
      severity: "warning",
      title: `ER referrals up ${pct(er.growth)}`,
      detail: `${er.last7} referrals to emergency care in the last 7 days versus ${er.prev7} previously — severity mix is shifting upward.`,
    });
  }
  for (const h of hotspots.slice(0, 3)) {
    if (h.growth >= 0.75 && h.recent >= 10) {
      anomalies.push({
        id: `hotspot-${h.postalCode}`,
        severity: h.growth >= 1.5 ? "critical" : "warning",
        title: `Cluster in postal code ${h.postalCode} (${pct(h.growth)})`,
        detail: `${h.recent} encounters in the last 14 days (${h.prior} in the prior fortnight), of which ${h.recentFocus} are ${focus.short}-coded.`,
      });
    }
  }
  for (const c of emergingCodes.slice(0, 3)) {
    if (c.growth >= 1 && c.recent >= 15) {
      anomalies.push({
        id: `code-${c.code}`,
        severity: "info",
        title: `Code ${c.code} rising fast (${pct(c.growth)})`,
        detail: `${c.recent} occurrences in the last 14 days versus a baseline of ${c.priorPer14} per fortnight.`,
      });
    }
  }
  if (anomalies.length === 0) {
    anomalies.push({
      id: "stable",
      severity: "info",
      title: "No significant signal above baseline",
      detail: "Weekly volumes, syndrome mix and severity are within expected variation.",
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    since: stats.since,
    generatedAt: stats.generatedAt,
    focus,
    total: Number(stats.total ?? 0),
    series,
    weekly: (stats.weekly ?? []).map((w) => ({
      week: w.w,
      total: Number(w.total),
      focus: Number(w.focus),
      redFlag: Number(w.red_flag),
      er: Number(w.er),
    })),
    metrics,
    hotspots,
    emergingCodes,
    ages,
    anomalies,
  };
}

export type OutbreakIntelligence = ReturnType<typeof computeSignals>;

/** Compact, token-cheap briefing handed to the outbreak-analyst agent. */
export function buildAnalystBriefing(intel: OutbreakIntelligence) {
  const last30 = intel.series.slice(-30).map((s) => ({
    d: s.date,
    all: s.total,
    focus: s.focus,
    resp: s.respiratory,
    er: s.er,
  }));

  return JSON.stringify(
    {
      focus: { label: intel.focus.label, icd10Prefixes: intel.focus.prefixes },
      windowSince: intel.since,
      generatedAt: intel.generatedAt,
      totalEncounters: intel.total,
      metrics: intel.metrics.map((m) => ({
        metric: m.label,
        last7: m.last7,
        prev7: m.prev7,
        wowGrowth: Number(m.growth.toFixed(2)),
        doublingDays: m.doublingDays ? Number(m.doublingDays.toFixed(1)) : null,
      })),
      last30Days: last30,
      weekly: intel.weekly.slice(-10),
      hotspots: intel.hotspots.slice(0, 8).map((h) => ({
        postalCode: h.postalCode,
        last14: h.recent,
        prior14: h.prior,
        focus14: h.recentFocus,
        growth: Number(h.growth.toFixed(2)),
      })),
      emergingCodes: intel.emergingCodes.map((c) => ({
        code: c.code,
        last14: c.recent,
        baselinePer14: c.priorPer14,
        growth: Number(c.growth.toFixed(2)),
      })),
      ageMix: intel.ages.map((a) => ({
        bracket: a.ageBracket,
        last14: a.recent,
        focus14: a.recentFocus,
        growth: Number(a.growth.toFixed(2)),
      })),
      detectedAnomalies: intel.anomalies.map((a) => `${a.severity.toUpperCase()}: ${a.title}`),
    },
    null,
    0,
  );
}
