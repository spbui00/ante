/** Shared practitioner role/specialisation options used by sign-up and settings. */

export const PRACTITIONER_ROLES = [
  { value: "DOCTOR", label: "Doctor", title: "Læge" },
  { value: "NURSE", label: "Nurse", title: "Sygeplejerske" },
] as const;

export type PractitionerRoleValue = (typeof PRACTITIONER_ROLES)[number]["value"];

export const SPECIALIZATIONS = [
  "General practice",
  "Internal medicine",
  "Cardiology",
  "Pulmonology",
  "Oncology",
  "Neurology",
  "Psychiatry",
  "Pediatrics",
  "Geriatrics",
  "Emergency medicine",
  "Surgery",
  "Obstetrics & gynaecology",
  "Dermatology",
  "Radiology",
  "Other",
] as const;

export function titleForRole(role: PractitionerRoleValue): string {
  return PRACTITIONER_ROLES.find((r) => r.value === role)?.title ?? "Læge";
}
