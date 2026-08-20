import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Compass, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getPractitionerWaitingRoom,
  recommendCareForVisit,
  searchPractitioners,
} from "@/lib/navigator.functions";

type Practitioner = {
  id: string;
  name: string;
  role: string;
  specialization: string | null;
  licenseNumber: string | null;
};

/** After a pre-intake, suggests who to see and shows that clinic's waiting room. */
export function CareNavigatorCard({ visitId }: { visitId: string }) {
  const [selected, setSelected] = useState<Practitioner | null>(null);
  const [term, setTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["care-navigator", visitId],
    queryFn: () => recommendCareForVisit({ data: { visitId } }),
    staleTime: 5 * 60_000,
  });

  const results = useQuery({
    queryKey: ["practitioner-search", searchTerm],
    queryFn: () => searchPractitioners({ data: { query: searchTerm } }),
    enabled: searchTerm.trim().length >= 2,
  });

  const waiting = useMutation({
    mutationFn: (practitionerId: string) =>
      getPractitionerWaitingRoom({ data: { practitionerId, visitId } }),
  });

  function choose(p: Practitioner) {
    setSelected(p);
    waiting.mutate(p.id);
  }

  const recommended = data?.careTeam.find((m) => m.id === data.practitionerId) ?? null;
  const others = (data?.careTeam ?? []).filter((m) => m.id !== data?.practitionerId);

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Compass className="size-4" />
          Where should you go?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Matching you to the right clinician…</p>
        ) : (
          <>
            <p className="text-sm text-foreground">{data?.reason}</p>

            {recommended ? (
              <PractitionerRow
                practitioner={recommended}
                highlighted
                selected={selected?.id === recommended.id}
                onSelect={() => choose(recommended)}
              />
            ) : data?.suggestedSpecialization ? (
              <p className="text-sm text-muted-foreground">
                Look for a clinician in{" "}
                <span className="font-medium text-foreground">{data.suggestedSpecialization}</span>{" "}
                using the search below.
              </p>
            ) : null}

            {others.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Others on your care team
                </p>
                {others.map((m) => (
                  <PractitionerRow
                    key={m.id}
                    practitioner={m}
                    selected={selected?.id === m.id}
                    onSelect={() => choose(m)}
                  />
                ))}
              </div>
            ) : null}

            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Search by name, specialty or license number
              </p>
              <div className="flex gap-2">
                <Input
                  value={term}
                  placeholder="e.g. Chen or 97240-76813"
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearchTerm(term)}
                />
                <Button variant="outline" onClick={() => setSearchTerm(term)}>
                  <Search className="size-4" />
                </Button>
              </div>
              {results.isFetching ? (
                <p className="text-xs text-muted-foreground">Searching…</p>
              ) : null}
              {results.data?.length === 0 && searchTerm ? (
                <p className="text-xs text-muted-foreground">No clinician matched that search.</p>
              ) : null}
              {(results.data ?? []).map((p) => (
                <PractitionerRow
                  key={p.id}
                  practitioner={p}
                  selected={selected?.id === p.id}
                  onSelect={() => choose(p)}
                />
              ))}
            </div>

            {selected ? (
              <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock className="size-4" />
                  Waiting room · {selected.name}
                </p>
                {waiting.isPending ? (
                  <p className="mt-1 text-xs text-muted-foreground">Checking the queue…</p>
                ) : waiting.data ? (
                  <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
                    <div>
                      <p className="text-xl font-semibold text-foreground">
                        {waiting.data.waitLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">{waiting.data.waitRange}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Likely #{waiting.data.predictedPosition} of {waiting.data.totalWaiting + 1}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Based on your{" "}
                        {waiting.data.myUrgency === "HIGH_RED_FLAG"
                          ? "urgent"
                          : waiting.data.myUrgency === "MEDIUM"
                            ? "medium"
                            : "routine"}{" "}
                        priority
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
                        (waiting.data.counts[key] ?? 0) > 0 ? (
                          <Badge key={key} variant={variant}>
                            {waiting.data.counts[key]} {label}
                          </Badge>
                        ) : null,
                      )}
                      {waiting.data.totalWaiting === 0 ? (
                        <span className="text-xs text-muted-foreground">Waiting room is empty</span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Could not read this waiting room right now.
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  This is an estimate for guidance only — your final priority is set by the clinic.
                </p>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PractitionerRow({
  practitioner,
  highlighted,
  selected,
  onSelect,
}: {
  practitioner: Practitioner;
  highlighted?: boolean;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : highlighted
            ? "border-primary/40 bg-primary/[0.05] hover:bg-primary/10"
            : "border-border hover:bg-muted/50"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{practitioner.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[practitioner.specialization, practitioner.licenseNumber].filter(Boolean).join(" · ") ||
            practitioner.role}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {highlighted ? "Recommended" : "Check queue"}
      </span>
    </button>
  );
}
