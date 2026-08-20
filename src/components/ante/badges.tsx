import { Badge } from "@/components/ui/badge";
import { DISPOSITION_LABEL, URGENCY_LABEL } from "@/lib/clinical-utils";
import { cn } from "@/lib/utils";

export function UrgencyBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        level === "HIGH_RED_FLAG" && "border-destructive bg-destructive text-destructive-foreground",
        level === "MEDIUM" && "border-warning text-warning",
        level === "LOW" && "border-border text-muted-foreground",
      )}
    >
      {URGENCY_LABEL[level] ?? level}
    </Badge>
  );
}

export function DispositionBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Badge variant="secondary" className="font-normal">
      {DISPOSITION_LABEL[value] ?? value}
    </Badge>
  );
}

export function CodeChip({ code, system }: { code: string; system?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
      {system ? <span className="text-muted-foreground">{system}</span> : null}
      {code}
    </span>
  );
}
