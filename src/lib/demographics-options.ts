export const SEX_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "INTERSEX", label: "Intersex" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const GENDER_IDENTITY_OPTIONS = [
  { value: "MAN", label: "Man" },
  { value: "WOMAN", label: "Woman" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "TRANSGENDER_MAN", label: "Transgender man" },
  { value: "TRANSGENDER_WOMAN", label: "Transgender woman" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "PARTNERED", label: "Partnered" },
  { value: "SEPARATED", label: "Separated" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "EMPLOYED", label: "Employed" },
  { value: "SELF_EMPLOYED", label: "Self-employed" },
  { value: "UNEMPLOYED", label: "Unemployed" },
  { value: "STUDENT", label: "Student" },
  { value: "RETIRED", label: "Retired" },
  { value: "UNABLE_TO_WORK", label: "Unable to work" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const INSURANCE_TYPE_OPTIONS = [
  { value: "PUBLIC_GROUP_1", label: "Public — Group 1" },
  { value: "PUBLIC_GROUP_2", label: "Public — Group 2" },
  { value: "PRIVATE", label: "Private" },
  { value: "EU_EHIC", label: "EU health card (EHIC)" },
  { value: "SELF_PAY", label: "Self-pay" },
  { value: "UNINSURED", label: "Uninsured" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const RACE_ETHNICITY_OPTIONS = [
  "White / European",
  "Black / African",
  "Middle Eastern / North African",
  "South Asian",
  "East Asian",
  "Southeast Asian",
  "Hispanic / Latino",
  "Indigenous / First Nations",
  "Greenlandic Inuit",
  "Mixed",
  "Other",
  "Prefer not to say",
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "da", label: "Dansk" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
  { value: "pl", label: "Polski" },
  { value: "so", label: "Soomaali" },
  { value: "ur", label: "اردو" },
] as const;

export type SexValue = (typeof SEX_OPTIONS)[number]["value"];
export type GenderIdentityValue = (typeof GENDER_IDENTITY_OPTIONS)[number]["value"];
export type MaritalStatusValue = (typeof MARITAL_STATUS_OPTIONS)[number]["value"];
export type EmploymentStatusValue = (typeof EMPLOYMENT_STATUS_OPTIONS)[number]["value"];
export type InsuranceTypeValue = (typeof INSURANCE_TYPE_OPTIONS)[number]["value"];
