import { useQuery } from "@tanstack/react-query";
import { Clock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyQueueStatus } from "@/lib/queue.functions";

/** Live waiting-room status, shown only while the patient has an ongoing visit. */
export function QueueStatusCard() {
  const { data } = useQuery({
    queryKey: ["my-queue-status"],
    queryFn: () => getMyQueueStatus(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  if (!data) return null;

  return (
    <Card className="border-primary/40 bg-primary/[0.06] lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4" />
          You are checked in
          {data.practitionerName ? (
            <span className="font-normal text-muted-foreground">
              · {data.practitionerName}
              {data.practitionerSpecialization ? ` (${data.practitionerSpecialization})` : ""}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-2xl font-semibold text-foreground">{data.waitLabel}</p>
            <p className="text-xs text-muted-foreground">{data.waitRange}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              #{data.position} of {data.totalWaiting}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.peopleAhead === 0
                ? "Nobody ahead of you"
                : `${data.peopleAhead} ${data.peopleAhead === 1 ? "person" : "people"} ahead`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {(
              [
                ["HIGH_RED_FLAG", "Urgent", "destructive"],
                ["MEDIUM", "Medium", "secondary"],
                ["LOW", "Routine", "outline"],
              ] as const
            ).map(([key, label, variant]) =>
              (data.counts[key] ?? 0) > 0 ? (
                <Badge key={key} variant={variant}>
                  {data.counts[key]} {label}
                </Badge>
              ) : null,
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Estimates update when the queue changes — they are a guide, not a guarantee.
        </p>
      </CardContent>
    </Card>
  );
}
