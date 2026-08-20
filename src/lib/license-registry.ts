/**
 * Mocked Autorisationsregisteret lookup.
 *
 * The real service exposes a REST endpoint that returns an authorisation's
 * title, status and any supervision/suspension flags. Until credentials are
 * available we resolve the same shape deterministically from the ID so the
 * sign-up flow can be exercised end to end.
 */

export const AUTH_ID_PATTERN = /^\d{5}-\d{5}$/;

export type PractitionerTitle = "Læge" | "Sygeplejerske";

export type LicenseLookup = {
  valid: boolean;
  authorisationId: string;
  title: PractitionerTitle | null;
  practitionerRole: "DOCTOR" | "NURSE" | null;
  status: "ACTIVE" | "SUSPENDED" | "UNDER_SUPERVISION" | "NOT_FOUND";
  underSupervision: boolean;
  message: string;
};

export function lookupAuthorisation(rawId: string, fullName: string): LicenseLookup {
  const authorisationId = rawId.trim();

  if (!AUTH_ID_PATTERN.test(authorisationId)) {
    return {
      valid: false,
      authorisationId,
      title: null,
      practitionerRole: null,
      status: "NOT_FOUND",
      underSupervision: false,
      message: "AutorisationsID must look like 00000-00000.",
    };
  }

  const digits = authorisationId.replace("-", "");
  const last = Number(digits[digits.length - 1]);
  const isNurse = last % 2 === 1;
  const suspended = digits.endsWith("00");
  const underSupervision = digits.endsWith("13");

  if (suspended) {
    return {
      valid: false,
      authorisationId,
      title: isNurse ? "Sygeplejerske" : "Læge",
      practitionerRole: isNurse ? "NURSE" : "DOCTOR",
      status: "SUSPENDED",
      underSupervision: false,
      message: "This authorisation is suspended in Autorisationsregisteret.",
    };
  }

  return {
    valid: true,
    authorisationId,
    title: isNurse ? "Sygeplejerske" : "Læge",
    practitionerRole: isNurse ? "NURSE" : "DOCTOR",
    status: underSupervision ? "UNDER_SUPERVISION" : "ACTIVE",
    underSupervision,
    message: underSupervision
      ? `Active authorisation for ${fullName || "practitioner"}, currently under supervision.`
      : `Active authorisation for ${fullName || "practitioner"}.`,
  };
}
