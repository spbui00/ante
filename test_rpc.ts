import { createClient } from "@supabase/supabase-js";
const s = JSON.parse(await Bun.file(process.env.HOME + "/.cache/lovable-auth/session.json").text());
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${s.session.access_token}` } },
});
const { data, error } = await sb.rpc("analytics_query", { _sql: "select encounter_day as day, count(*)::int as cases from surveillance_encounter where encounter_date >= now() - interval '14 days' group by encounter_day order by day", _limit: 20 });
console.log("error", error, "rows", Array.isArray(data) ? data.length : data);
console.log(JSON.stringify(data)?.slice(0,200));
const bad = await sb.rpc("analytics_query", { _sql: "delete from patient", _limit: 5 });
console.log("guard:", bad.error?.message);
