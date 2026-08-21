import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ante/app-shell";
import { ConsultationRecorder } from "@/components/ante/consultation-recorder";
import { PatientPassportPanel } from "@/components/ante/patient-passport-panel";

import { UrgencyBadge } from "@/components/ante/badges";
import { MarkdownEditor } from "@/components/ante/markdown-editor";
import { RichText } from "@/components/ante/rich-text";
import { Badge } from "@/components/ui/badge";
import { VisitClinicalItems } from "@/components/ante/visit-clinical-items";
import { VisitTranscript } from "@/components/ante/visit-transcript";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { finaliseVisit, getVisitDetail, updateVisitSymptoms } from "@/lib/ante.functions";
import { getVisitClinicalItems } from "@/lib/visit-clinical.functions";

import { ENCOUNTER_TYPE_LABEL, formatDateTime } from "@/lib/clinical-utils";

export const Route = createFileRoute("/_authenticated/consultation/$visitId")({
  head: () => ({
    meta: [
      { title: "Consultation — Ante" },
      {
        name: "description",
        content:
          "Run a consultation: the patient's clinical passport, the intake form and ambient recording in one workspace.",
      },
      { property: "og:title", content: "Consultation — Ante" },
      {
        property: "og:description",
        content: "Patient passport, intake form and ambient consultation recording.",
      },
    ],
  }),
  errorComponent: () => (
    <AppShell title="Consultation">
      <p className="text-sm text-muted-foreground">Could not load this consultation.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Consultation">
      <p className="text-sm text-muted-foreground">Consultation not found.</p>
    </AppShell>
  ),
  component: ConsultationPage,
});

function ConsultationPage() {
  const { visitId } = useParams({ from: "/_authenticated/consultation/$visitId" });
  const queryClient = useQueryClient();
  const [recorderOpen, setRecorderOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["visit-detail", visitId],
    queryFn: () => getVisitDetail({ data: { visitId } }),
  });

  const { data: clinicalItems } = useQuery({
    queryKey: ["visit-clinical-items", visitId],
    queryFn: () => getVisitClinicalItems({ data: { visitId } }),
  });


  const visit = data?.visit as
    | ({
        id: string;
        visit_date: string;
        status?: string | null;
        symptoms?: string | null;
        intake_transcript?: string | null;
        visit_transcript?: string | null;

        conclusion?: string | null;
        recommendation?: string | null;
        urgency_level?: string | null;
        disposition?: string | null;
        encounter_type?: string | null;
        arrived_at?: string | null;
        taken_in_at?: string | null;
        completed_at?: string | null;
        patient_id: string;
        patient?: { full_name?: string | null } | null;
      })
    | null
    | undefined;

  const [conclusion, setConclusion] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [urgency, setUrgency] = useState("LOW");
  const [disposition, setDisposition] = useState("HOME_CARE");

  useEffect(() => {
    if (!visit) return;
    setConclusion(visit.conclusion ?? "");
    setRecommendation(visit.recommendation ?? "");
    setSymptoms(visit.symptoms ?? "");
    setUrgency(visit.urgency_level ?? "LOW");
    setDisposition(visit.disposition ?? "HOME_CARE");
  }, [visit?.id]);

  const saveSymptoms = useMutation({
    mutationFn: () => updateVisitSymptoms({ data: { visitId, symptoms } }),
    onSuccess: () => {
      toast.success("Symptoms updated");
      void queryClient.invalidateQueries({ queryKey: ["visit-detail", visitId] });
      void queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message ? error.message : "Could not save symptoms",
      ),
  });


  const signOff = useMutation({
    mutationFn: () =>
      finaliseVisit({
        data: {
          visitId,
          conclusion,
          recommendation,
          symptoms,

          urgencyLevel: urgency as "LOW" | "MEDIUM" | "HIGH_RED_FLAG",
          disposition: disposition as "HOME_CARE" | "PRESCRIPTION" | "ER_REFERRAL",
        },
      }),
    onSuccess: () => {
      toast.success("Consultation signed off");
      void queryClient.invalidateQueries({ queryKey: ["visit-detail", visitId] });
      void queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not save the consultation",
      ),
  });

  const recordCount = clinicalItems?.records?.length ?? 0;
  const missing: string[] = [];
  if (!conclusion.trim()) missing.push("a conclusion");
  if (!recommendation.trim()) missing.push("a recommendation");
  if (recordCount === 0) missing.push("at least one clinical record");


  const isCompleted = visit?.status === "COMPLETED";
  const patientName = visit?.patient?.full_name ?? "Patient";

  return (
    <AppShell
      title={isPending ? "Consultation" : `Consultation · ${patientName}`}
      {...(visit ? { subtitle: formatDateTime(visit.visit_date) } : {})}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clinical">
            <ArrowLeft className="size-4" />
            Back to console
          </Link>
        </Button>
        {isCompleted ? (
          <Badge variant="secondary" className="ml-auto">
            Completed · read-only
          </Badge>
        ) : (
          <Button className="ml-auto" onClick={() => setRecorderOpen(true)} disabled={!visit}>
            <Mic className="size-4" />
            Start recording
          </Button>
        )}

      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading consultation…</p>
      ) : !visit ? (
        <p className="text-sm text-muted-foreground">
          This visit is not available — access requires an active consent grant.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <PatientPassportPanel patientId={visit.patient_id} />

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Intake</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <UrgencyBadge level={visit.urgency_level} />
                  <span className="text-xs text-muted-foreground">
                    {ENCOUNTER_TYPE_LABEL[visit.encounter_type ?? ""] ?? "Visit"}
                  </span>
                  {isCompleted ? (
                    <Badge variant="secondary" className="ml-auto">
                      Completed
                    </Badge>
                  ) : null}
                </div>

                {isCompleted ? (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    This consultation is signed off and read-only.
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Arrived" value={visit.arrived_at} />
                  <Field label="Consultation started" value={visit.taken_in_at} />
                  <Field label="Completed" value={visit.completed_at} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="symptoms">Symptoms</Label>
                    {isCompleted ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveSymptoms.mutate()}
                        disabled={
                          saveSymptoms.isPending || symptoms === (visit.symptoms ?? "")
                        }
                      >
                        {saveSymptoms.isPending ? "Saving…" : "Save symptoms"}
                      </Button>
                    )}
                  </div>
                  {isCompleted ? (
                    <RichText text={symptoms || "Not recorded"} />
                  ) : (
                    <MarkdownEditor
                      id="symptoms"
                      value={symptoms}
                      onChange={setSymptoms}
                      placeholder="Reported symptoms…"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conclusion">Conclusion</Label>
                  {isCompleted ? (
                    <RichText text={conclusion || "Not recorded"} />
                  ) : (
                    <MarkdownEditor
                      id="conclusion"
                      value={conclusion}
                      onChange={setConclusion}
                      placeholder="Clinical conclusion…"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendation">Recommendation</Label>
                  {isCompleted ? (
                    <RichText text={recommendation || "Not recorded"} />
                  ) : (
                    <MarkdownEditor
                      id="recommendation"
                      value={recommendation}
                      onChange={setRecommendation}
                      placeholder="Plan and follow-up…"
                    />
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select value={urgency} onValueChange={setUrgency} disabled={isCompleted}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH_RED_FLAG">Red flag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Disposition</Label>
                    <Select
                      value={disposition}
                      onValueChange={setDisposition}
                      disabled={isCompleted}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOME_CARE">Home care</SelectItem>
                        <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
                        <SelectItem value="ER_REFERRAL">ER referral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isCompleted ? null : (
                  <>
                    {missing.length ? (
                      <p className="text-xs text-muted-foreground">
                        Before signing off, add {missing.join(", ")}.
                      </p>
                    ) : null}

                    <Button
                      onClick={() => signOff.mutate()}
                      disabled={signOff.isPending || missing.length > 0}
                    >
                      {signOff.isPending ? "Signing off…" : "Sign off consultation"}
                    </Button>
                  </>
                )}


              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Clinical items</CardTitle>
              </CardHeader>
              <CardContent>
                <VisitClinicalItems visitId={visitId} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Transcript</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <VisitTranscript transcript={visit.intake_transcript} label="Intake transcript" />
                <VisitTranscript transcript={visit.visit_transcript} label="Visit transcript" />
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {visit ? (
        <ConsultationRecorder
          visitId={visitId}
          patientName={patientName}
          open={recorderOpen}
          onOpenChange={setRecorderOpen}
          onSigned={() => {
            void queryClient.invalidateQueries({ queryKey: ["visit-detail", visitId] });
            void queryClient.invalidateQueries({ queryKey: ["visit-clinical-items", visitId] });
            void queryClient.invalidateQueries({ queryKey: ["clinical-queue"] });
            void queryClient.invalidateQueries({ queryKey: ["patient-visits"] });
          }}
        />
      ) : null}

      <Drawer open={handoutOpen} onOpenChange={setHandoutOpen}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col">
            <DrawerHeader>
              <DrawerTitle>Patient summary</DrawerTitle>
              <DrawerDescription>
                Plain-language after-visit summary, medicines and safety advice for {patientName}.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {handout.isPending ? (
                <p className="text-sm text-muted-foreground">Writing the patient summary…</p>
              ) : handout.data?.text ? (
                <RichText text={handout.data.text} />
              ) : (
                <p className="text-sm text-muted-foreground">No summary generated yet.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <Button
                variant="ghost"
                disabled={handout.isPending || !handout.data?.text}
                onClick={() => {
                  void navigator.clipboard.writeText(handout.data?.text ?? "");
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={() => handout.mutate()} disabled={handout.isPending}>
                Regenerate
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value ? formatDateTime(value) : "—"}</p>
    </div>
  );
}
