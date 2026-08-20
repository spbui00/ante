import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type AnteRole = "PATIENT" | "PRACTITIONER" | "ANALYST";

export const ROLE_HOME: Record<AnteRole, string> = {
  PATIENT: "/passport",
  PRACTITIONER: "/clinical",
  ANALYST: "/surveillance",
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export const rolesQueryKey = (userId?: string | null) => ["user-roles", userId ?? "anon"] as const;

export function useRoles() {
  const { user, loading: sessionLoading } = useSession();

  const { data, isPending } = useQuery({
    queryKey: rolesQueryKey(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AnteRole);
    },
  });

  const roles = user ? (data ?? []) : [];
  const loading = sessionLoading || (Boolean(user) && isPending);

  return { roles, loading, hasRole: (role: AnteRole) => roles.includes(role) };
}
