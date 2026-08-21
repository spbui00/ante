import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data, error } = await sb.rpc("analytics_query", { _sql: "select encounter_day as day, count(*)::int as cases from surveillance_encounter where encounter_date >= now() - interval '14 days' group by encounter_day order by day", _limit: 20 });
console.log("error", error, "rows", Array.isArray(data) ? data.length : data);
console.log(JSON.stringify(data)?.slice(0,300));
