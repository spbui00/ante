import { Pencil, Trash2 } from "lucide-react";

import { DispositionBadge, UrgencyBadge } from "@/components/ante/badges";
import { RichText } from "@/components/ante/rich-text";
import { VisitClinicalItems } from "@/components/ante/visit-clinical-items";
import { VisitTranscript } from "@/components/ante/visit-transcript";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ENCOUNTER_TYPE_LABEL, formatDate, formatDateTime } from "@/lib/clinical-utils";

export const VISIT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export type VisitDetail = {
  id: string;
  visit_date: string;
  status?: string | null;
  encounter_type?: string | null;
  urgency_level?: string | null;
  disposition?: string | null;
  symptoms?: string | null;
  intake_transcript?: string | null;
  visit_transcript?: string | null;

  conclusion?: string | null;
  recommendation?: string | null;
  arrived_at?: string | null;
  taken_in_at?: string | null;
  completed_at?: string | null;
  practitioner?: {
    full_name?: string | null;
    title?: string | null;
    specialization?: string | null;
  } | null;
};

export function VisitDetailDrawer({
  visit,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  visit: VisitDetail | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const canEdit = visit?.status === "SCHEDULED";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[90vh] flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Visit details</DrawerTitle>
            <DrawerDescription>{visit ? formatDate(visit.visit_date) : "—"}</DrawerDescription>
          </DrawerHeader>

          {visit ? (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                {visit.encounter_type ? (
                  <Badge variant="outline">
                    {ENCOUNTER_TYPE_LABEL[visit.encounter_type] ?? visit.encounter_type}
                  </Badge>
                ) : null}
                <UrgencyBadge level={visit.urgency_level} />
                {visit.status ? (
                  <Badge variant="secondary">
                    {VISIT_STATUS_LABEL[visit.status] ?? visit.status}
                  </Badge>
                ) : null}
                <DispositionBadge value={visit.disposition} />
              </div>

              <DetailSection
                label="Clinician"
                value={(() => {
                  const p = visit.practitioner;
                  if (!p?.full_name) return "—";
                  return [[p.title, p.full_name].filter(Boolean).join(" "), p.specialization]
                    .filter(Boolean)
                    .join(" · ");
                })()}
              />

              <div className="space-y-1">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Timeline
                </h4>
                <dl className="grid gap-1 text-sm sm:grid-cols-3">
                  <TimelineItem label="Arrived" value={visit.arrived_at} />
                  <TimelineItem label="Consultation started" value={visit.taken_in_at} />
                  <TimelineItem label="Completed" value={visit.completed_at} />
                </dl>
              </div>

              <DetailSection label="Symptoms" value={visit.symptoms ?? "No symptoms recorded."} />
              <DetailSection
                label="Conclusion"
                value={visit.conclusion ?? "No conclusion recorded."}
              />
              <DetailSection
                label="Recommendation"
                value={visit.recommendation ?? "No recommendation recorded."}
              />

              <VisitTranscript transcript={visit.intake_transcript} label="Intake transcript" />
              <VisitTranscript transcript={visit.visit_transcript} label="Visit transcript" />

              <div className="border-t border-border pt-4">
                <VisitClinicalItems visitId={visit.id} />
              </div>

            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Select a visit to view details.
            </div>
          )}


          <DrawerFooter className="flex-row justify-end">
            {canEdit && onDelete ? (
              <Button
                variant="ghost"
                className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
            {canEdit && onEdit ? (
              <Button onClick={onEdit}>
                <Pencil className="size-4" />
                Edit intake
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h4>
      <RichText text={value} />
    </div>
  );
}

function TimelineItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value ? formatDateTime(value) : "—"}</dd>
    </div>
  );
}
