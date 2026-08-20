import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { AnteMark } from "@/components/ante/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ROLE_HOME, type AnteRole } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ante Clinical Passport" },
      {
        name: "description",
        content:
          "Sign in to Ante to access your clinical passport, the practitioner console or the epidemiological surveillance dashboard.",
      },
      { property: "og:title", content: "Sign in — Ante" },
      { property: "og:description", content: "Access your Ante clinical passport or console." },
    ],
  }),
  component: AuthPage,
});

const ROLES: { value: AnteRole; label: string; hint: string }[] = [
  { value: "PATIENT", label: "Patient", hint: "Personal clinical passport" },
  { value: "PRACTITIONER", label: "Practitioner", hint: "Consultation console" },
  { value: "ANALYST", label: "Analyst", hint: "Surveillance dashboard" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AnteRole>("PATIENT");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      await routeByRole(navigate);
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await routeByRole(navigate);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created");
    await routeByRole(navigate);
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    await routeByRole(navigate);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <AnteMark className="mb-6 justify-center text-lg" />
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Welcome to Ante</CardTitle>
            <CardDescription>
              One passport for patients, one console for clinicians, one signal for public health.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <form className="space-y-4" onSubmit={handleSignIn}>
                  <Field id="email" label="Email" value={email} onChange={setEmail} type="email" />
                  <Field
                    id="password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                  />
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form className="space-y-4" onSubmit={handleSignUp}>
                  <Field id="name" label="Full name" value={fullName} onChange={setFullName} />
                  <Field
                    id="email2"
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    type="email"
                  />
                  <Field
                    id="password2"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                  />
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <div className="grid gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRole(r.value)}
                          className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            role === r.value
                              ? "border-ring bg-accent text-accent-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <span className="font-medium">{r.label}</span>
                          <span className="block text-xs text-muted-foreground">{r.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogle}>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const role = (roles?.[0]?.role ?? "PATIENT") as AnteRole;
  navigate({ to: ROLE_HOME[role], replace: true });
}
