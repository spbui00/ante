import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RichTextInline } from "@/components/ante/rich-text";
import { VisitCard } from "@/components/ante/visit-card";
import { VisitDetailDrawer, type VisitDetail } from "@/components/ante/visit-detail-drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPatientRecord } from "@/lib/ante.functions";
import { formatCpr, formatDate } from "@/lib/clinical-utils";

export function PatientPassportPanel({ patientId }: { patientId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["patient-record", patientId],
    queryFn: () => getPatientRecord({ data: { patientId } }),
  });

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [openVisit, setOpenVisit] = useState<VisitDetail | null>(null);

  const allVisits = (data?.visits ?? []) as (VisitDetail & { practitioner_id?: string | null })[];
  const mine = data?.viewerPractitionerId
    ? allVisits.filter((v) => v.practitioner_id === data.viewerPractitionerId)
    : [];
  const visits = scope === "mine" ? mine : allVisits;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {data?.patient?.full_name ?? "Patient passport"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {data?.patient
              ? [
                  formatCpr(data.patient.cpr_number),
                  data.patient.date_of_birth
                    ? `born ${formatDate(data.patient.date_of_birth)}`
                    : null,
                  data.patient.postal_code,
                ]
                  .filter((x) => x && x !== "—")
                  .join(" · ")
              : "Loading consented record…"}
          </p>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Tabs defaultValue="medical">
              <TabsList>
                <TabsTrigger value="medical">Medical info</TabsTrigger>
                <TabsTrigger value="visits">Visits</TabsTrigger>
              </TabsList>

              <TabsContent value="medical" className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Group title="Conditions">
                    {(data?.records ?? [])
                      .filter((r) => r.category === "CONDITION")
                      .map((r) => (
                        <Line key={r.id} primary={r.description} secondary={r.code ?? undefined} />
                      ))}
                  </Group>
                  <Group title="Allergies">
                    {(data?.records ?? [])
                      .filter((r) => r.category === "ALLERGY")
                      .map((r) => (
                        <Line key={r.id} primary={r.description} secondary={r.status} />
                      ))}
                  </Group>
                  <Group title="Active medications">
                    {(data?.prescriptions ?? [])
                      .filter((p) => !p.end_date)
                      .map((p) => (
                        <Line
                          key={p.id}
                          primary={p.drug_name}
                          secondary={[p.dosage, p.frequency].filter(Boolean).join(" · ")}
                        />
                      ))}
                  </Group>
                  <Group title="Recent observations">
                    {(data?.observations ?? []).slice(0, 8).map((o) => (
                      <Line
                        key={o.id}
                        primary={o.test_name}
                        secondary={`${o.value ?? "—"} ${o.unit ?? ""} · ${formatDate(o.recorded_at)}`}
                      />
                    ))}
                  </Group>
                </div>
              </TabsContent>

              <TabsContent value="visits" className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={scope === "mine" ? "default" : "outline"}
                    onClick={() => setScope("mine")}
                  >
                    My visits ({mine.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={scope === "all" ? "default" : "outline"}
                    onClick={() => setScope("all")}
                  >
                    All practitioners ({allVisits.length})
                  </Button>
                </div>

                {visits.map((v) => (
                  <VisitCard key={v.id} visit={v} onClick={() => setOpenVisit(v)} />
                ))}
                {visits.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    {scope === "mine"
                      ? "No visits with you yet. Switch to all practitioners to see the full history."
                      : "No visits recorded."}
                  </p>
                ) : null}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <VisitDetailDrawer
        visit={openVisit}
        open={Boolean(openVisit)}
        onOpenChange={(o) => !o && setOpenVisit(null)}
      />
    </div>
  );
}

function Group({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {empty ? <p className="py-2 text-sm text-muted-foreground">Nothing recorded</p> : children}
      </CardContent>
    </Card>
  );
}

function Line({ primary, secondary }: { primary: string; secondary?: string | undefined }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <RichTextInline className="text-sm font-medium text-foreground" text={primary} />
      {secondary ? (
        <RichTextInline className="text-xs text-muted-foreground" text={secondary} />
      ) : null}
    </div>
  );
}
