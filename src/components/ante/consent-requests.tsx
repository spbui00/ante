import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ScanFace, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getMyConsentRequests, respondToConsent } from "@/lib/ante.functions";
import { formatDateTime } from "@/lib/clinical-utils";

type ConsentRequest = Awaited<ReturnType<typeof getMyConsentRequests>>["requests"][number];

export function ConsentRequests() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-consent-requests"],
    queryFn: () => getMyConsentRequests(),
  });

  const [scanFor, setScanFor] = useState<ConsentRequest | null>(null);
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");

  const pending = (data?.requests ?? []).filter((r) => r.status === "PENDING");

  const respond = useMutation({
    mutationFn: (vars: { id: string; accept: boolean }) =>
      respondToConsent({ data: { consentId: vars.id, accept: vars.accept } }),
    onSuccess: (_r, vars) => {
      toast.success(vars.accept ? "Access granted" : "Request declined");
      setScanFor(null);
      void queryClient.invalidateQueries({ queryKey: ["my-consent-requests"] });
    },
    onError: () => toast.error("Could not update this request"),
  });

  useEffect(() => {
    if (!scanFor) return;
    setPhase("scanning");
    const t = setTimeout(() => setPhase("done"), 1800);
    return () => clearTimeout(t);
  }, [scanFor]);

  if (pending.length === 0) return null;

  return (
    <>
      <Card className="border-primary/40 bg-primary/[0.05] lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldQuestion className="size-4" />
            Consent requests ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {pending.map((req) => {
            const p = req.practitioner as {
              full_name?: string;
              title?: string | null;
              specialization?: string | null;
              organization?: { name?: string } | null;
            } | null;
            return (
              <div
                key={req.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/70 px-4 py-3"
              >
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {[p?.title, p?.full_name].filter(Boolean).join(" ") || "A practitioner"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[p?.specialization, p?.organization?.name].filter(Boolean).join(" · ") ||
                      "Requesting access to your clinical passport"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested {formatDateTime(req.created_at)}
                    {req.expires_at ? ` · access until ${formatDateTime(req.expires_at)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: req.id, accept: false })}
                  >
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => setScanFor(req)}>
                    <ScanFace className="size-4" />
                    Approve
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Drawer open={!!scanFor} onOpenChange={(o) => !o && setScanFor(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader>
              <DrawerTitle>Verify it's you</DrawerTitle>
              <DrawerDescription>
                Face ID confirms your identity before sharing your clinical passport.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-col items-center gap-3 px-4 py-6">
              <div
                className={`grid size-28 place-items-center rounded-3xl border-2 transition-colors ${
                  phase === "done"
                    ? "border-primary bg-primary/10"
                    : "animate-pulse border-primary/40 bg-muted"
                }`}
              >
                {phase === "done" ? (
                  <CheckCircle2 className="size-12 text-primary" />
                ) : (
                  <ScanFace className="size-12 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {phase === "done" ? "Face recognised" : "Scanning your face…"}
              </p>
            </div>

            <DrawerFooter className="flex-row justify-end gap-2">
              <Button variant="ghost" onClick={() => setScanFor(null)}>
                Cancel
              </Button>
              <Button
                disabled={phase !== "done" || respond.isPending}
                onClick={() => scanFor && respond.mutate({ id: scanFor.id, accept: true })}
              >
                {respond.isPending ? "Granting…" : "Grant access"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
