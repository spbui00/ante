import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { stripFollowUpMarker } from "@/lib/clinical-utils";
import { cn } from "@/lib/utils";

/** Read-only view of a visit's intake + consultation transcript. */
export function VisitTranscript({
  transcript,
  label = "Transcript",
  defaultOpen = false,
  className,
}: {
  transcript?: string | null | undefined;
  label?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const text = stripFollowUpMarker(transcript);

  return (
    <div className={cn("space-y-2", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2 gap-2" disabled={!text}>
            <FileText className="size-4" />
            {text ? label : `No ${label.toLowerCase()} recorded`}
            {text ? (
              <ChevronDown
                className={cn("size-4 transition-transform", open && "rotate-180")}
              />
            ) : null}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-sans text-sm leading-relaxed text-foreground">
            {text}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
