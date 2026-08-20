import { CalendarDays, Pencil, Trash2 } from "lucide-react";

import { DispositionBadge, UrgencyBadge } from "@/components/ante/badges";
import { RichTextInline } from "@/components/ante/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ENCOUNTER_TYPE_LABEL, formatDate } from "@/lib/clinical-utils";
import { cn } from "@/lib/utils";

export const VISIT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export type VisitCardData = {
  id: string;
  visit_date: string;
  encounter_type?: string | null;
  urgency_level?: string | null;
  status?: string | null;
  disposition?: string | null;
  conclusion?: string | null;
  symptoms?: string | null;
  practitioner?: {
    full_name?: string | null;
    title?: string | null;
    specialization?: string | null;
  } | null;
};

export function VisitCard({
  visit,
  onClick,
  onEdit,
  onDelete,
  className,
}: {
  visit: VisitCardData;
  onClick?: () => void;
  /** Shown as an "Edit intake" action (used for SCHEDULED drafts). */
  onEdit?: () => void;
  /** Shown as a "Delete" action (used for SCHEDULED drafts). */
  onDelete?: () => void;
  className?: string;
}) {
  const practitioner = visit.practitioner;

  return (
    <Card
      className={cn(
        onClick && "cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CalendarDays className="size-4 text-muted-foreground" />
            {formatDate(visit.visit_date)}
          </span>
          {visit.encounter_type ? (
            <Badge variant="outline" className="font-normal">
              {ENCOUNTER_TYPE_LABEL[visit.encounter_type] ?? visit.encounter_type}
            </Badge>
          ) : null}
          <UrgencyBadge level={visit.urgency_level as never} />
          {visit.status ? (
            <Badge variant="secondary" className="font-normal">
              {VISIT_STATUS_LABEL[visit.status] ?? visit.status}
            </Badge>
          ) : null}
          <DispositionBadge value={visit.disposition as never} />
          {practitioner?.full_name ? (
            <span className="ml-auto text-xs text-muted-foreground">
              {[practitioner.title, practitioner.full_name].filter(Boolean).join(" ")}
              {practitioner.specialization ? ` · ${practitioner.specialization}` : ""}
            </span>
          ) : null}
        </div>
        <RichTextInline
          className="line-clamp-2 text-sm text-muted-foreground"
          text={visit.conclusion || visit.symptoms || "No conclusion recorded."}
        />
        {onEdit || onDelete ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {onEdit ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="size-4" />
                Edit intake
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
