import { createClient } from "@supabase/supabase-js";
import { runSurveillanceAnalysis } from "/dev-server/src/lib/analytics-agent.server";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const res = await runSurveillanceAnalysis({ supabase: sb as any, days: 60, role: "a public-health analyst", instruction: "Analyse the whole log for this window and build the dashboard." });
console.log("STEPS", JSON.stringify(res.steps, null, 1).slice(0, 2000));
console.log("NARRATIVE", (res.narrative||"").slice(0, 600));
console.log("CARDS", res.cards.map(c => ({ kind: c.kind, title: c.title, rows: c.rows.length, err: c.error })));
