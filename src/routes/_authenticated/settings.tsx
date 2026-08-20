import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCareTeamMember,
  getMyCareTeam,
  getMySettings,
  removeCareTeamMember,
  updateMySettings,
} from "@/lib/ante.functions";
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
        content: "Update the name, date of birth, sex and postal code on your Ante account.",
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
  const [preferredName, setPreferredName] = useState(data.patient?.preferred_name ?? "");
  const [sex, setSex] = useState<SexValue | "">((data.patient?.sex as SexValue) ?? "");
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentityValue | "">(
    (data.patient?.gender_identity as GenderIdentityValue) ?? "",
  );
  const [raceEthnicity, setRaceEthnicity] = useState<string[]>(data.patient?.race_ethnicity ?? []);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatusValue | "">(
    (data.patient?.marital_status as MaritalStatusValue) ?? "",
  );
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatusValue | "">(
    (data.patient?.employment_status as EmploymentStatusValue) ?? "",
  );
  const [insuranceType, setInsuranceType] = useState<InsuranceTypeValue | "">(
    (data.patient?.insurance_type as InsuranceTypeValue) ?? "",
  );
  const [insuranceProvider, setInsuranceProvider] = useState(data.patient?.insurance_provider ?? "");
  const [insuranceMemberId, setInsuranceMemberId] = useState(
    data.patient?.insurance_member_id ?? "",
  );

  const save = useMutation({
    mutationFn: () =>
      updateMySettings({
        data: {
          fullName: `${firstName} ${lastName}`.trim() || fullName,
          dateOfBirth,
          postalCode,
          primaryLanguage,
          firstName,
          lastName,
          practitionerRole,
          specialization,
          licenseNumber,
          phoneNumber,
          preferredName,
          sex: sex || null,
          genderIdentity: genderIdentity || null,
          raceEthnicity,
          maritalStatus: maritalStatus || null,
          employmentStatus: employmentStatus || null,
          insuranceType: insuranceType || null,
          insuranceProvider,
          insuranceMemberId,
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
                    <Select value={sex} onValueChange={(v) => setSex(v as SexValue)}>
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
                    <Select value={genderIdentity} onValueChange={(v) => setGenderIdentity(v as GenderIdentityValue)}>
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
                    <Select value={maritalStatus} onValueChange={(v) => setMaritalStatus(v as MaritalStatusValue)}>
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
                    <Select value={employmentStatus} onValueChange={(v) => setEmploymentStatus(v as EmploymentStatusValue)}>
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
                    <Select value={insuranceType} onValueChange={(v) => setInsuranceType(v as InsuranceTypeValue)}>
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

        {data.patient ? <CareTeamCard /> : null}



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

const careTeamQuery = queryOptions({
  queryKey: ["my-care-team"],
  queryFn: () => getMyCareTeam(),
});

type CareTeamData = Awaited<ReturnType<typeof getMyCareTeam>>;
type CareTeamMember = CareTeamData["careTeam"][number];
type ConsentRow = CareTeamData["consents"][number];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CareTeamMemberDrawer({
  member,
  consent,
  open,
  onOpenChange,
}: {
  member: CareTeamMember | null;
  consent?: ConsentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const p = member?.practitioner;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>
            {p?.title ? `${p.title} ` : ""}
            {p?.full_name ?? "Practitioner"}
          </DrawerTitle>
          <DrawerDescription>
            {member?.specialization}
            {member?.is_primary ? " · Primary" : ""}
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-8 text-sm">
          <div className="grid gap-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Practitioner</p>
            <Row label="Role" value={p?.role ?? "—"} />
            <Row label="Specialisation" value={p?.specialization ?? member?.specialization ?? "—"} />
            <Row label="License" value={p?.license_number ?? "—"} />
            <Row label="Organisation" value={p?.organization?.name ?? "—"} />
            <Row label="Region" value={p?.organization?.region ?? "—"} />
            <Row label="Care team status" value={member?.status ?? "—"} />
            <Row label="Added" value={formatDate(member?.assigned_at)} />
          </div>

          <div className="grid gap-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Record access</p>
            {consent ? (
              <>
                <Row label="Status" value={consent.status} />
                <Row label="Granted" value={formatDate(consent.granted_at)} />
                <Row
                  label="Expires"
                  value={consent.expires_at ? formatDate(consent.expires_at) : "No expiry"}
                />
                {consent.is_emergency_override ? (
                  <Row label="Type" value="Emergency override" />
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                This practitioner has no consent grant for your records.
              </p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function CareTeamCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery(careTeamQuery);
  const [practitionerId, setPractitionerId] = useState("");
  const [teamSpecialization, setTeamSpecialization] = useState("");
  const [selected, setSelected] = useState<CareTeamMember | null>(null);

  const add = useMutation({
    mutationFn: () =>
      addCareTeamMember({
        data: { practitionerId, specialization: teamSpecialization },
      }),
    onSuccess: async () => {
      toast.success("Care team updated");
      setPractitionerId("");
      setTeamSpecialization("");
      await queryClient.invalidateQueries({ queryKey: ["my-care-team"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeCareTeamMember({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-care-team"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const consentFor = (practitionerId?: string | null) =>
    (data?.consents ?? []).find(
      (c) => c.practitioner_id === practitionerId && c.status === "ACTIVE",
    ) ??
    (data?.consents ?? []).find((c) => c.practitioner_id === practitionerId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Care team</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data?.careTeam?.length ? (
          <ul className="grid gap-2">
            {data.careTeam.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  className="flex-1 text-left transition-colors hover:text-primary"
                  onClick={() => setSelected(member)}
                >
                  <span className="font-medium">
                    {member.practitioner?.title ? `${member.practitioner.title} ` : ""}
                    {member.practitioner?.full_name ?? "Unknown"}
                  </span>
                  <span className="text-muted-foreground"> · {member.specialization}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(member.id)}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No practitioners linked yet. Add the specialists who look after you.
          </p>
        )}

        <CareTeamMemberDrawer
          member={selected}
          consent={consentFor(selected?.practitioner?.id)}
          open={Boolean(selected)}
          onOpenChange={(open) => !open && setSelected(null)}
        />


        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ctPractitioner">Practitioner</Label>
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger id="ctPractitioner">
                <SelectValue placeholder="Select practitioner" />
              </SelectTrigger>
              <SelectContent>
                {(data?.practitioners ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title ? `${p.title} ` : ""}
                    {p.full_name}
                    {p.specialization ? ` · ${p.specialization}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ctSpec">Specialisation</Label>
            <Select value={teamSpecialization} onValueChange={setTeamSpecialization}>
              <SelectTrigger id="ctSpec">
                <SelectValue placeholder="Select specialisation" />
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
        <div>
          <Button
            onClick={() => add.mutate()}
            disabled={!practitionerId || !teamSpecialization || add.isPending}
          >
            {add.isPending ? "Adding…" : "Add to care team"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
