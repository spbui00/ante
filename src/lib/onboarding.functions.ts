import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupAuthorisation } from "@/lib/license-registry";

/** Mocked Autorisationsregisteret verification for a practitioner sign-up (pre-auth). */
export const verifyPractitioner = createServerFn({ method: "POST" })

  .inputValidator((input: unknown) =>
    z.object({ fullName: z.string().max(120).default(""), authorisationId: z.string().max(32) }).parse(input),
  )
  .handler(async ({ data }) => lookupAuthorisation(data.authorisationId, data.fullName));

/** Applies the chosen role (and practitioner authorisation) to the signed-in account. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        role: z.enum(["PATIENT", "PRACTITIONER", "ANALYST"]),
        fullName: z.string().max(120).optional(),
        firstName: z.string().max(60).optional(),
        lastName: z.string().max(60).optional(),
        practitionerRole: z.enum(["DOCTOR", "NURSE"]).optional(),
        specialization: z.string().max(80).optional(),
        authorisationId: z.string().max(32).optional(),
        phoneNumber: z.string().max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let practitionerRole: "DOCTOR" | "NURSE" = data.practitionerRole ?? "DOCTOR";
    let verified = false;
    let title: string | null = null;

    const composedName =
      data.fullName ??
      [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ??
      undefined;

    if (data.role === "PRACTITIONER") {
      const lookup = lookupAuthorisation(data.authorisationId ?? "", composedName ?? "");
      if (!lookup.valid) throw new Error(lookup.message);
      verified = true;
      title = practitionerRole === "NURSE" ? "Sygeplejerske" : "Læge";
    }

    const args: {
      _role: "PATIENT" | "PRACTITIONER" | "ANALYST";
      _practitioner_role: "DOCTOR" | "NURSE";
      _verified: boolean;
      _full_name?: string;
      _license?: string;
      _first_name?: string;
      _last_name?: string;
      _title?: string;
      _specialization?: string;
      _phone?: string;
    } = { _role: data.role, _practitioner_role: practitionerRole, _verified: verified };
    if (composedName) args._full_name = composedName;
    if (data.role === "PATIENT") {
      if (data.firstName) args._first_name = data.firstName;
      if (data.lastName) args._last_name = data.lastName;
      if (data.phoneNumber) args._phone = data.phoneNumber;
    }
    if (data.role === "PRACTITIONER") {
      if (data.authorisationId) args._license = data.authorisationId;
      if (data.firstName) args._first_name = data.firstName;
      if (data.lastName) args._last_name = data.lastName;
      if (data.specialization) args._specialization = data.specialization;
      if (title) args._title = title;
    }

    const { error } = await supabase.rpc("apply_onboarding", args);
    if (error) throw new Error(error.message);

    return { ok: true, role: data.role, title, verified };
  });

