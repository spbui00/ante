import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { lookupAuthorisation } from "@/lib/license-registry";

const Body = z.object({ fullName: z.string().max(120).optional(), authorisationId: z.string().max(32) });

export const Route = createFileRoute("/api/verify-doctor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "authorisationId is required" }, { status: 400 });
        }
        const result = lookupAuthorisation(parsed.data.authorisationId, parsed.data.fullName ?? "");
        return Response.json(result, { status: result.valid ? 200 : 422 });
      },
    },
  },
});
