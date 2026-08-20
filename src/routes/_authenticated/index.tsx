import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME, type AnteRole } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const role = (roles?.[0]?.role ?? "PATIENT") as AnteRole;
    throw redirect({ to: ROLE_HOME[role] });
  },
  component: () => null,
});
