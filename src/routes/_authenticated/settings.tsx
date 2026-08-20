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
import {
  PRACTITIONER_ROLES,
  SPECIALIZATIONS,
  type PractitionerRoleValue,
} from "@/lib/practitioner-options";
import {
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_IDENTITY_OPTIONS,
  INSURANCE_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RACE_ETHNICITY_OPTIONS,
  SEX_OPTIONS,
  type EmploymentStatusValue,
  type GenderIdentityValue,
  type InsuranceTypeValue,
  type MaritalStatusValue,
  type SexValue,
} from "@/lib/demographics-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [firstName, setFirstName] = useState(
    data.practitioner?.first_name ?? data.patient?.first_name ?? "",
  );
  const [lastName, setLastName] = useState(
    data.practitioner?.last_name ?? data.patient?.last_name ?? "",
  );
  const [phoneNumber, setPhoneNumber] = useState(data.patient?.phone_number ?? "");
  const [practitionerRole, setPractitionerRole] = useState<PractitionerRoleValue>(
    (data.practitioner?.role as PractitionerRoleValue) ?? "DOCTOR",
  );
  const [specialization, setSpecialization] = useState(data.practitioner?.specialization ?? "");
  const [licenseNumber, setLicenseNumber] = useState(data.practitioner?.license_number ?? "");

  const save = useMutation({
    mutationFn: () =>
      updateMySettings({
        data: {
          fullName: `${firstName} ${lastName}`.trim() || fullName,
          dateOfBirth,
          gender,
          postalCode,
          primaryLanguage,
          firstName,
          lastName,
          practitionerRole,
          specialization,
          licenseNumber,
          phoneNumber,
        },
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
            {data.practitioner ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="practRole">Title</Label>
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
                  <div className="grid gap-2">
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
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="license">Licence number (AutorisationsID)</Label>
                  <Input
                    id="license"
                    value={licenseNumber}
                    onChange={(event) => setLicenseNumber(event.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                </div>
                {data.patient ? (
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneNumber ?? ""}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {data.patient ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="preferredName">Preferred name</Label>
                  <Input
                    id="preferredName"
                    value={preferredName ?? ""}
                    onChange={(event) => setPreferredName(event.target.value)}
                  />
                </div>
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
                    <Label htmlFor="sex">Sex</Label>
                    <Select value={sex} onValueChange={setSex}>
                      <SelectTrigger id="sex">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEX_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="genderIdentity">Gender identity</Label>
                    <Select value={genderIdentity} onValueChange={setGenderIdentity}>
                      <SelectTrigger id="genderIdentity">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_IDENTITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lang">Primary language</Label>
                    <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
                      <SelectTrigger id="lang">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Race / ethnicity</Label>
                  <div className="flex flex-wrap gap-2">
                    {RACE_ETHNICITY_OPTIONS.map((option) => {
                      const active = raceEthnicity.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setRaceEthnicity((current) =>
                              current.includes(option)
                                ? current.filter((value) => value !== option)
                                : [...current, option],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="marital">Marital status</Label>
                    <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                      <SelectTrigger id="marital">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARITAL_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="employment">Employment</Label>
                    <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                      <SelectTrigger id="employment">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="insuranceType">Insurance</Label>
                    <Select value={insuranceType} onValueChange={setInsuranceType}>
                      <SelectTrigger id="insuranceType">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {INSURANCE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="insuranceProvider">Insurer</Label>
                    <Input
                      id="insuranceProvider"
                      value={insuranceProvider ?? ""}
                      onChange={(event) => setInsuranceProvider(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="insuranceMemberId">Member ID</Label>
                    <Input
                      id="insuranceMemberId"
                      value={insuranceMemberId ?? ""}
                      onChange={(event) => setInsuranceMemberId(event.target.value)}
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
                    <Label htmlFor="gender">Gender (legacy free text)</Label>
                    <Input
                      id="gender"
                      value={gender ?? ""}
                      onChange={(event) => setGender(event.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div>
              <Button
                onClick={() => save.mutate()}
                disabled={
                  save.isPending ||
                  (data.practitioner
                    ? !firstName.trim() || !lastName.trim()
                    : !fullName.trim())
                }
              >
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
                  {data.practitioner.organization?.name ?? "—"} ·{" "}
                  {data.practitioner.title ?? data.practitioner.role}
                  {data.practitioner.specialization
                    ? ` · ${data.practitioner.specialization}`
                    : ""}
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
