import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMySettings, updateMySettings } from "@/lib/ante.functions";

const settingsQuery = queryOptions({
  queryKey: ["my-settings"],
  queryFn: () => getMySettings(),
});

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Ante" },
      {
        name: "description",
        content: "Update the name, date of birth, gender and postal code on your Ante account.",
      },
      { property: "og:title", content: "Account Settings — Ante" },
      { property: "og:description", content: "Manage your Ante profile details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  errorComponent: () => (
    <AppShell title="Settings">
      <p className="text-sm text-muted-foreground">Could not load your account settings.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Settings">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(
    data.patient?.full_name ?? data.profile?.full_name ?? "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(data.patient?.date_of_birth ?? "");
  const [gender, setGender] = useState(data.patient?.gender ?? "");
  const [postalCode, setPostalCode] = useState(data.patient?.postal_code ?? "");
  const [primaryLanguage, setPrimaryLanguage] = useState(data.patient?.primary_language ?? "da");

  const save = useMutation({
    mutationFn: () =>
      updateMySettings({
        data: { fullName, dateOfBirth, gender, postalCode, primaryLanguage },
      }),
    onSuccess: async () => {
      toast.success("Profile updated");
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Settings" subtitle={data.profile?.email ?? "Manage your account details"}>
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            {data.patient ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dob">Date of birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={dateOfBirth ?? ""}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Input
                      id="gender"
                      value={gender ?? ""}
                      onChange={(event) => setGender(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postal">Postal code</Label>
                    <Input
                      id="postal"
                      value={postalCode ?? ""}
                      onChange={(event) => setPostalCode(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lang">Preferred language</Label>
                    <Input
                      id="lang"
                      value={primaryLanguage ?? ""}
                      onChange={(event) => setPrimaryLanguage(event.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !fullName.trim()}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>
              Email: <span className="text-foreground">{data.profile?.email ?? "—"}</span>
            </p>
            <p>
              Role: <span className="text-foreground">{data.role}</span>
            </p>
            {data.practitioner ? (
              <p>
                Practice:{" "}
                <span className="text-foreground">
                  {data.practitioner.organization?.name ?? "—"} · {data.practitioner.role}
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
