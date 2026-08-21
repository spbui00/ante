/**
 * Weather context for de-identified encounters (server-only).
 *
 * Environmental conditions are a real epidemiological signal (cold snaps and
 * respiratory waves, heat and cardiovascular load), so every anonymized
 * encounter carries the weather of the day it happened.
 *
 * Source: Open-Meteo — a keyless, edge-friendly weather service. Postal codes
 * are resolved to coarse coordinates only; nothing here touches identifiers.
 */

type Coords = { lat: number; lon: number };

export type WeatherConditions = {
  source: string;
  date: string;
  latitude: number;
  longitude: number;
  temperature_mean_c: number | null;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  precipitation_mm: number | null;
  humidity_mean_pct: number | null;
  wind_max_kmh: number | null;
  summary: string;
};

const COPENHAGEN: Coords = { lat: 55.6761, lon: 12.5683 };

const coordCache = new Map<string, Coords>();
const weatherCache = new Map<string, WeatherConditions>();

async function fetchJson(url: string, timeoutMs = 6000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Danish postal code -> approximate centroid. Falls back to Copenhagen. */
export async function resolvePostalCode(postalCode: string | null | undefined): Promise<Coords> {
  const code = String(postalCode ?? "").trim();
  if (!/^\d{4}$/.test(code)) return COPENHAGEN;
  const cached = coordCache.get(code);
  if (cached) return cached;

  const data = await fetchJson(`https://api.zippopotam.us/dk/${code}`);
  const place = data?.places?.[0];
  const lat = Number(place?.latitude);
  const lon = Number(place?.longitude);
  const coords: Coords =
    Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : COPENHAGEN;
  coordCache.set(code, coords);
  return coords;
}

function describe(w: Omit<WeatherConditions, "summary">): string {
  const parts: string[] = [];
  if (w.temperature_mean_c != null) {
    const t = w.temperature_mean_c;
    const band =
      t < 0 ? "freezing" : t < 8 ? "cold" : t < 16 ? "cool" : t < 24 ? "mild" : "hot";
    parts.push(`${band} (${t.toFixed(1)}°C mean)`);
  }
  if (w.precipitation_mm != null) {
    parts.push(
      w.precipitation_mm < 0.2
        ? "dry"
        : w.precipitation_mm < 5
          ? `light precipitation (${w.precipitation_mm.toFixed(1)} mm)`
          : `wet (${w.precipitation_mm.toFixed(1)} mm)`,
    );
  }
  if (w.humidity_mean_pct != null) parts.push(`${Math.round(w.humidity_mean_pct)}% humidity`);
  if (w.wind_max_kmh != null) parts.push(`wind to ${Math.round(w.wind_max_kmh)} km/h`);
  return parts.join(", ") || "no weather data";
}

/**
 * Daily weather for a date and postal code. Never throws — returns null when
 * the service is unreachable so a consultation sign-off is never blocked.
 */
export async function getWeatherForEncounter(
  postalCode: string | null | undefined,
  when: Date,
): Promise<WeatherConditions | null> {
  const day = when.toISOString().slice(0, 10);
  const { lat, lon } = await resolvePostalCode(postalCode);
  const key = `${day}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
  const cached = weatherCache.get(key);
  if (cached) return cached;

  const ageDays = (Date.now() - when.getTime()) / 86_400_000;
  // The archive series lags a few days; the forecast endpoint covers the
  // recent past and the near future.
  const host = ageDays > 30 ? "https://archive-api.open-meteo.com" : "https://api.open-meteo.com";
  const daily =
    "temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max";
  const url = `${host}/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${day}&end_date=${day}&daily=${daily}&timezone=UTC`;

  const data = await fetchJson(host.includes("archive") ? url.replace("/v1/forecast", "/v1/archive") : url);
  const d = data?.daily;
  if (!d || !Array.isArray(d.time) || d.time.length === 0) return null;

  const num = (arr: unknown): number | null => {
    const v = Array.isArray(arr) ? arr[0] : null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const base = {
    source: "open-meteo",
    date: day,
    latitude: Number(lat.toFixed(2)),
    longitude: Number(lon.toFixed(2)),
    temperature_mean_c: num(d.temperature_2m_mean),
    temperature_min_c: num(d.temperature_2m_min),
    temperature_max_c: num(d.temperature_2m_max),
    precipitation_mm: num(d.precipitation_sum),
    humidity_mean_pct: num(d.relative_humidity_2m_mean),
    wind_max_kmh: num(d.wind_speed_10m_max),
  };

  const result: WeatherConditions = { ...base, summary: describe(base) };
  weatherCache.set(key, result);
  return result;
}
