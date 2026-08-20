import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupAuthorisation } from "@/lib/license-registry";

/** Mocked Autorisationsregisteret verification for a practitioner sign-up. */
export const verifyPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        authorisationId: z.string().max(32).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let practitionerRole: "DOCTOR" | "NURSE" = "DOCTOR";
    let verified = false;
    let title: string | null = null;

    if (data.role === "PRACTITIONER") {
      const lookup = lookupAuthorisation(data.authorisationId ?? "", data.fullName ?? "");
      if (!lookup.valid) throw new Error(lookup.message);
      practitionerRole = lookup.practitionerRole ?? "DOCTOR";
      verified = true;
      title = lookup.title;
    }

    const { error } = await supabase.rpc("apply_onboarding", {
      _role: data.role,
      _full_name: data.fullName ?? null,
      _license: data.role === "PRACTITIONER" ? (data.authorisationId ?? null) : null,
      _practitioner_role: practitionerRole,
      _verified: verified,
    });
    if (error) throw new Error(error.message);

    return { ok: true, role: data.role, title, verified };
  });
