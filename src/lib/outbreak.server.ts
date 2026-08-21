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
  covid: number;
  respiratory: number;
  gastro: number;
  febrile: number;
  red_flag: number;
  er: number;
};

export type WeeklyRow = { w: string; total: number; covid: number; red_flag: number; er: number };
export type PostalRow = {
  postal_code: string;
  recent: number;
  prior: number;
  recent_covid: number;
};
export type CodeRow = { code: string; recent: number; prior: number };
export type AgeRow = {
  age_bracket: string;
  recent: number;
  prior: number;
  recent_covid: number;
};

export type OutbreakStats = {
  since: string;
  generatedAt: string;
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
export type Syndrome = (typeof SYNDROMES)[number] | "covid" | "total";

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

export function computeSignals(stats: OutbreakStats) {
  const daily = [...(stats.daily ?? [])].sort((a, b) => a.d.localeCompare(b.d));

  const series = daily.map((r, i, arr) => ({
    date: r.d,
    total: Number(r.total),
    covid: Number(r.covid),
    respiratory: Number(r.respiratory),
    gastro: Number(r.gastro),
    febrile: Number(r.febrile),
    redFlag: Number(r.red_flag),
    er: Number(r.er),
    totalAvg: 0,
    covidAvg: 0,
    respiratoryAvg: 0,
    _i: i,
    _n: arr.length,
  }));

  const avgs: Record<string, number[]> = {
    totalAvg: movingAverage(series.map((s) => s.total), 7),
    covidAvg: movingAverage(series.map((s) => s.covid), 7),
    respiratoryAvg: movingAverage(series.map((s) => s.respiratory), 7),
  };
  series.forEach((s, i) => {
    s.totalAvg = Number(avgs.totalAvg[i].toFixed(1));
    s.covidAvg = Number(avgs.covidAvg[i].toFixed(1));
    s.respiratoryAvg = Number(avgs.respiratoryAvg[i].toFixed(1));
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
    metric("covid", "COVID-19 (U07.1)"),
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
        recentCovid: Number(p.recent_covid),
        growth: prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0,
      };
    })
    .sort((a, b) => b.recentCovid - a.recentCovid || b.growth - a.growth)
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
      recentCovid: Number(a.recent_covid),
      growth: Number(a.prior) > 0 ? (Number(a.recent) - Number(a.prior)) / Number(a.prior) : 0,
    }))
    .filter((a) => a.recent > 0)
    .sort((a, b) => b.recent - a.recent);

  const covid = metrics.find((m) => m.key === "covid")!;
  const resp = metrics.find((m) => m.key === "respiratory")!;
  const er = metrics.find((m) => m.key === "er")!;

  const anomalies: Anomaly[] = [];
  const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

  if (covid.last7 > 0 && covid.growth >= 0.5) {
    anomalies.push({
      id: "covid-growth",
      severity: covid.growth >= 1 ? "critical" : "warning",
      title: `COVID-19 encounters ${pct(covid.growth)} week over week`,
      detail: `${covid.last7} coded U07.1 encounters in the last 7 days versus ${covid.prev7} the week before${
        covid.doublingDays ? `, doubling roughly every ${covid.doublingDays.toFixed(1)} days` : ""
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
        detail: `${h.recent} encounters in the last 14 days (${h.prior} in the prior fortnight), of which ${h.recentCovid} are COVID-coded.`,
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
    total: Number(stats.total ?? 0),
    series,
    weekly: (stats.weekly ?? []).map((w) => ({
      week: w.w,
      total: Number(w.total),
      covid: Number(w.covid),
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
    covid: s.covid,
    resp: s.respiratory,
    er: s.er,
  }));

  return JSON.stringify(
    {
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
        covid14: h.recentCovid,
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
        covid14: a.recentCovid,
        growth: Number(a.growth.toFixed(2)),
      })),
      detectedAnomalies: intel.anomalies.map((a) => `${a.severity.toUpperCase()}: ${a.title}`),
    },
    null,
    0,
  );
}
