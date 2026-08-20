import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";

import { AnteMark } from "@/components/ante/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ROLE_HOME, type AnteRole } from "@/hooks/use-session";
import { completeOnboarding, verifyPractitioner } from "@/lib/onboarding.functions";
import { AUTH_ID_PATTERN } from "@/lib/license-registry";
import {
  PRACTITIONER_ROLES,
  SPECIALIZATIONS,
  type PractitionerRoleValue,
} from "@/lib/practitioner-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { value: "PRACTITIONER", label: "Doctor or nurse", hint: "Consultation console — requires AutorisationsID" },
  { value: "ANALYST", label: "Analyst", hint: "Surveillance dashboard" },
];

const PENDING_KEY = "ante.pending-onboarding";

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [practitionerRole, setPractitionerRole] = useState<PractitionerRoleValue>("DOCTOR");
  const [specialization, setSpecialization] = useState<string>("General practice");
  const [authorisationId, setAuthorisationId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<AnteRole | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      await finishPendingOnboarding();
      await routeByRole(navigate, queryClient);
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
    await routeByRole(navigate, queryClient);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    try {
      if (role !== "ANALYST") {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error("Enter your first and last name.");
        }
      }
      if (role === "PRACTITIONER" && !AUTH_ID_PATTERN.test(authorisationId.trim())) {
        throw new Error("AutorisationsID must look like 00000-00000.");
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: signupName(), role },
        },
      });
      if (error) throw new Error(error.message);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.success("Account created — confirm your email, then sign in.");
        return;
      }

      const result = await completeOnboarding({
        data: {
          role,
          fullName: signupName(),
          ...(role === "PRACTITIONER"
            ? {
                authorisationId,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                practitionerRole,
                specialization,
              }
            : {}),
          ...(role === "PATIENT"
            ? {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
              }
            : {}),
        },
      });
      toast.success(
        result.title ? `Verified as ${result.title} in Autorisationsregisteret` : "Account created",
      );
      await routeByRole(navigate, queryClient);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  function signupName() {
    return role === "ANALYST" ? fullName : `${firstName.trim()} ${lastName.trim()}`.trim();
  }

  async function handleCheckLicense() {
    setBusy(true);
    try {
      const result = await verifyPractitioner({ data: { fullName: signupName(), authorisationId } });
      if (result.valid) toast.success(`${result.title} — ${result.message}`);
      else toast.error(result.message);
    } catch {
      toast.error("Could not reach Autorisationsregisteret");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(signUpRole?: AnteRole) {
    if (signUpRole) {
      if (signUpRole === "PRACTITIONER" && !AUTH_ID_PATTERN.test(authorisationId.trim())) {
        toast.error("Enter your AutorisationsID (00000-00000) before continuing with Google.");
        return;
      }
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          role: signUpRole,
          authorisationId: authorisationId.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim(),
          practitionerRole,
          specialization,
        }),
      );
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    await finishPendingOnboarding();
    await routeByRole(navigate, queryClient);
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

              <TabsContent value="signin" className="mt-4 space-y-4">
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
                <Divider />
                <Button variant="outline" className="w-full" onClick={() => handleGoogle()}>
                  Continue with Google
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-4 space-y-4">
                {role === null ? (
                  <div className="space-y-2">
                    <Label>Who are you?</Label>
                    <div className="grid gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRole(r.value)}
                          className="rounded-md border border-border px-3 py-3 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{r.label}</span>
                          <span className="block text-xs text-muted-foreground">{r.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setRole(null)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3" />
                      {ROLES.find((r) => r.value === role)?.label} — change
                    </button>

                    <form className="space-y-4" onSubmit={handleSignUp}>
                      {role === "PRACTITIONER" ? (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              id="firstName"
                              label="First name"
                              value={firstName}
                              onChange={setFirstName}
                            />
                            <Field
                              id="lastName"
                              label="Last name"
                              value={lastName}
                              onChange={setLastName}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="practRole">I am a</Label>
                            <Select
                              value={practitionerRole}
                              onValueChange={(v) => setPractitionerRole(v as PractitionerRoleValue)}
                            >
                              <SelectTrigger id="practRole">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRACTITIONER_ROLES.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {r.label} ({r.title})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="spec">Specialisation</Label>
                            <Select value={specialization} onValueChange={setSpecialization}>
                              <SelectTrigger id="spec">
                                <SelectValue placeholder="Select a specialisation" />
                              </SelectTrigger>
                              <SelectContent>
                                {SPECIALIZATIONS.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : role === "PATIENT" ? (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              id="firstName"
                              label="First name"
                              value={firstName}
                              onChange={setFirstName}
                            />
                            <Field
                              id="lastName"
                              label="Last name"
                              value={lastName}
                              onChange={setLastName}
                            />
                          </div>
                          <Field
                            id="phone"
                            label="Phone number"
                            type="tel"
                            value={phoneNumber}
                            onChange={setPhoneNumber}
                          />
                        </>
                      ) : (
                        <Field id="name" label="Full name" value={fullName} onChange={setFullName} />
                      )}

                      {role === "PRACTITIONER" ? (
                        <div className="space-y-2">
                          <Label htmlFor="authid">AutorisationsID</Label>
                          <div className="flex gap-2">
                            <Input
                              id="authid"
                              required
                              placeholder="00000-00000"
                              value={authorisationId}
                              onChange={(e) => setAuthorisationId(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              onClick={handleCheckLicense}
                            >
                              <BadgeCheck className="size-4" />
                              Check
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Checked against Autorisationsregisteret for title and active status.
                          </p>
                        </div>
                      ) : null}

                      <Field id="email2" label="Email" value={email} onChange={setEmail} type="email" />
                      <Field
                        id="password2"
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        type="password"
                      />
                      <Button type="submit" className="w-full" disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                        Create account
                      </Button>
                    </form>

                    <Divider />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleGoogle(role)}
                    >
                      Continue with Google
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
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

/** Applies a role chosen before a Google redirect, once the session exists. */
async function finishPendingOnboarding() {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return;
  sessionStorage.removeItem(PENDING_KEY);
  try {
    const pending = JSON.parse(raw) as {
      role: AnteRole;
      authorisationId?: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      practitionerRole?: "DOCTOR" | "NURSE";
      specialization?: string;
    };
    const { data } = await supabase.auth.getUser();
    const name = (data.user?.user_metadata?.["full_name"] ??
      data.user?.user_metadata?.["name"] ??
      "") as string;
    const result = await completeOnboarding({
      data: {
        role: pending.role,
        ...(name ? { fullName: name } : {}),
        ...(pending.authorisationId ? { authorisationId: pending.authorisationId } : {}),
        ...(pending.firstName ? { firstName: pending.firstName } : {}),
        ...(pending.lastName ? { lastName: pending.lastName } : {}),
        ...(pending.phoneNumber ? { phoneNumber: pending.phoneNumber } : {}),
        ...(pending.practitionerRole ? { practitionerRole: pending.practitionerRole } : {}),
        ...(pending.specialization ? { specialization: pending.specialization } : {}),
      },
    });
    if (result.title) toast.success(`Verified as ${result.title} in Autorisationsregisteret`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not finish sign-up");
  }
}

async function routeByRole(navigate: ReturnType<typeof useNavigate>, queryClient?: QueryClient) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const role = (roles?.[0]?.role ?? "PATIENT") as AnteRole;
  await queryClient?.invalidateQueries({ queryKey: ["user-roles"] });
  navigate({ to: ROLE_HOME[role], replace: true });
}
