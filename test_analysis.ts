import { createClient } from "@supabase/supabase-js";
import { runSurveillanceAnalysis } from "/dev-server/src/lib/analytics-agent.server";
const s = JSON.parse(await Bun.file(process.env.HOME + "/.cache/lovable-auth/session.json").text());
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${s.session.access_token}` } },
});
const res = await runSurveillanceAnalysis({ supabase: sb as any, days: 60, role: "a public-health analyst", instruction: "Analyse the whole log for this window and build the dashboard." });
console.log("STEPS", res.steps.map(x => ({ rows: x.rows, err: x.error })));
console.log("NARRATIVE", (res.narrative||"").slice(0, 500));
console.log("CARDS", res.cards.map(c => ({ kind: c.kind, title: c.title, rows: c.rows.length, cfg: c.config })));
