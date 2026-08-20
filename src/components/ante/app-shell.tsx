import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, LogOut, ShieldCheck, Stethoscope, User } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useRoles, type AnteRole } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: ReactNode; roles: AnteRole[] };

const NAV: NavItem[] = [
  { to: "/passport", label: "Passport", icon: <User className="size-4" />, roles: ["PATIENT"] },
  {
    to: "/clinical",
    label: "Clinical",
    icon: <Stethoscope className="size-4" />,
    roles: ["PRACTITIONER"],
  },
  {
    to: "/surveillance",
    label: "Surveillance",
    icon: <Activity className="size-4" />,
    roles: ["ANALYST"],
  },
];

export function AnteMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <ShieldCheck className="size-4" />
      </span>
      Ante
    </span>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { roles, loading: rolesLoading } = useRoles();
  const visibleNav = rolesLoading
    ? []
    : NAV.filter((item) => item.roles.some((role) => roles.includes(role)));

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Link to="/">
            <AnteMark />
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </div>

      <nav className="sticky bottom-0 z-30 flex border-t border-border bg-background md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
            activeProps={{ className: "text-accent-foreground bg-accent" }}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
