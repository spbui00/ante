import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  deleteVisitClinicalItem,
  getVisitClinicalItems,
  saveVisitObservation,
  saveVisitPrescription,
  saveVisitRecord,
} from "@/lib/visit-clinical.functions";

type Kind = "observation" | "prescription" | "record";

const RECORD_CATEGORIES = ["CONDITION", "PROCEDURE", "ALLERGY", "REFERRAL"] as const;
const RECORD_STATUSES = ["ACTIVE", "RESOLVED", "SUSPECTED"] as const;
const CODE_SYSTEMS = ["ICD10", "SKS", "ICPC2", "SNOMED", "LOINC", "ATC"] as const;

type Draft = Record<string, string>;

export function VisitClinicalItems({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["visit-clinical-items", visitId];
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => getVisitClinicalItems({ data: { visitId } }),
  });

  const [editing, setEditing] = useState<{ kind: Kind; id: string | null } | null>(null);
  const [draft, setDraft] = useState<Draft>({});

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["patient-record"] });
    void queryClient.invalidateQueries({ queryKey: ["passport"] });
  };

  const save = useMutation({
    mutationFn: async ({ kind, id, values }: { kind: Kind; id: string | null; values: Draft }) => {
      const base = { visitId, ...(id ? { id } : {}) };
      if (kind === "observation") {
        return saveVisitObservation({
          data: {
            ...base,
            testName: values["test_name"] ?? "",
            loincCode: values["loinc_code"] ?? null,
            value: values["value"] ? Number(values["value"]) : null,
            unit: values["unit"] ?? null,
            ...(values["recorded_at"] ? { recordedAt: values["recorded_at"] } : {}),
          },
        });
      }
      if (kind === "prescription") {
        return saveVisitPrescription({
          data: {
            ...base,
            drugName: values["drug_name"] ?? "",
            atcCode: values["atc_code"] ?? null,
            dosage: values["dosage"] ?? null,
            frequency: values["frequency"] ?? null,
            startDate: values["start_date"] ?? null,
            endDate: values["end_date"] ?? null,
          },
        });
      }
      return saveVisitRecord({
        data: {
          ...base,
          category: (values["category"] ?? "CONDITION") as (typeof RECORD_CATEGORIES)[number],
          codeSystem: (values["code_system"] ?? "ICD10") as (typeof CODE_SYSTEMS)[number],
          code: values["code"] ?? null,
          description: values["description"] ?? "",
          status: (values["status"] ?? "ACTIVE") as (typeof RECORD_STATUSES)[number],
        },
      });
    },
    onSuccess: () => {
      setEditing(null);
      setDraft({});
      invalidate();
      toast.success("Saved to visit");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (v: { kind: Kind; id: string }) =>
      deleteVisitClinicalItem({ data: { visitId, id: v.id, kind: v.kind } }),
    onSuccess: () => {
      invalidate();
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading clinical items…</p>;
  }

  const canEdit = data?.canEdit ?? false;

  const startAdd = (kind: Kind) => {
    setEditing({ kind, id: null });
    setDraft(
      kind === "record"
        ? { category: "CONDITION", code_system: "ICD10", status: "ACTIVE" }
        : kind === "observation"
          ? { recorded_at: new Date().toISOString().slice(0, 10) }
          : { start_date: new Date().toISOString().slice(0, 10) },
    );
  };

  const startEdit = (kind: Kind, row: Record<string, unknown>) => {
    setEditing({ kind, id: String(row["id"]) });
    const next: Draft = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "object") continue;
      next[k] = k === "recorded_at" ? String(v).slice(0, 10) : String(v);
    }
    setDraft(next);
  };

  const isEditing = (kind: Kind, id: string | null) =>
    editing?.kind === kind && editing.id === id;

  const field = (key: string) => ({
    value: draft[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value })),
  });

  const formActions = (kind: Kind, id: string | null) => (
    <div className="flex gap-2 pt-1">
      <Button
        size="sm"
        disabled={save.isPending}
        onClick={() => save.mutate({ kind, id, values: draft })}
      >
        <Check className="size-4" />
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setEditing(null);
          setDraft({});
        }}
      >
        <X className="size-4" />
        Cancel
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Observations */}
      <Section title="Observations" canEdit={canEdit} onAdd={() => startAdd("observation")}>
        <ItemsTable
          headers={["Test", "Value", "LOINC", "Recorded"]}
          canEdit={canEdit}
          empty={(data?.observations.length ?? 0) === 0 && !isEditing("observation", null)}
          emptyText="No observations recorded"
        >
          {(data?.observations ?? []).map((o) =>
            isEditing("observation", o.id) ? (
              <EditRow key={o.id} span={5}>
                <ObservationForm field={field} />
                {formActions("observation", o.id)}
              </EditRow>
            ) : (
              <Row
                key={o.id}
                cells={[
                  o.test_name,
                  [o.value ?? "—", o.unit].filter(Boolean).join(" "),
                  o.loinc_code ?? "—",
                  formatDate(o.recorded_at),
                ]}
                canEdit={canEdit}
                onEdit={() => startEdit("observation", o as unknown as Record<string, unknown>)}
                onDelete={() => remove.mutate({ kind: "observation", id: o.id })}
              />
            ),
          )}
          {isEditing("observation", null) ? (
            <EditRow span={5}>
              <ObservationForm field={field} />
              {formActions("observation", null)}
            </EditRow>
          ) : null}
        </ItemsTable>
      </Section>

      {/* Prescriptions */}
      <Section title="Prescriptions" canEdit={canEdit} onAdd={() => startAdd("prescription")}>
        <ItemsTable
          headers={["Drug", "Dosage", "Frequency", "ATC", "Period"]}
          canEdit={canEdit}
          empty={(data?.prescriptions.length ?? 0) === 0 && !isEditing("prescription", null)}
          emptyText="No prescriptions recorded"
        >
          {(data?.prescriptions ?? []).map((p) =>
            isEditing("prescription", p.id) ? (
              <EditRow key={p.id} span={6}>
                <PrescriptionForm field={field} />
                {formActions("prescription", p.id)}
              </EditRow>
            ) : (
              <Row
                key={p.id}
                cells={[
                  p.drug_name,
                  p.dosage ?? "—",
                  p.frequency ?? "—",
                  p.atc_code ?? "—",
                  [
                    p.start_date ? formatDate(p.start_date) : null,
                    p.end_date ? formatDate(p.end_date) : null,
                  ]
                    .filter(Boolean)
                    .join(" → ") || "—",
                ]}
                canEdit={canEdit}
                onEdit={() => startEdit("prescription", p as unknown as Record<string, unknown>)}
                onDelete={() => remove.mutate({ kind: "prescription", id: p.id })}
              />
            ),
          )}
          {isEditing("prescription", null) ? (
            <EditRow span={6}>
              <PrescriptionForm field={field} />
              {formActions("prescription", null)}
            </EditRow>
          ) : null}
        </ItemsTable>
      </Section>

      {/* Clinical records */}
      <Section title="Clinical records" canEdit={canEdit} onAdd={() => startAdd("record")}>
        <ItemsTable
          headers={["Description", "Category", "Code", "Status"]}
          canEdit={canEdit}
          empty={(data?.records.length ?? 0) === 0 && !isEditing("record", null)}
          emptyText="No clinical records"
        >
          {(data?.records ?? []).map((r) =>
            isEditing("record", r.id) ? (
              <EditRow key={r.id} span={5}>
                <RecordForm field={field} draft={draft} setDraft={setDraft} />
                {formActions("record", r.id)}
              </EditRow>
            ) : (
              <Row
                key={r.id}
                cells={[
                  r.description,
                  <Badge key="c" variant="outline" className="font-normal">
                    {r.category.charAt(0) + r.category.slice(1).toLowerCase()}
                  </Badge>,
                  r.code ? `${r.code_system} ${r.code}` : r.code_system,
                  r.status.charAt(0) + r.status.slice(1).toLowerCase(),
                ]}
                canEdit={canEdit}
                onEdit={() => startEdit("record", r as unknown as Record<string, unknown>)}
                onDelete={() => remove.mutate({ kind: "record", id: r.id })}
              />
            ),
          )}
          {isEditing("record", null) ? (
            <EditRow span={5}>
              <RecordForm field={field} draft={draft} setDraft={setDraft} />
              {formActions("record", null)}
            </EditRow>
          ) : null}
        </ItemsTable>
      </Section>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          Read-only — only the clinician who ran this visit can edit its clinical items.
        </p>
      ) : null}
    </div>
  );
}


type FieldFn = (key: string) => {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function ObservationForm({ field }: { field: FieldFn }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Labeled label="Test name">
        <Input placeholder="Blood pressure" {...field("test_name")} />
      </Labeled>
      <Labeled label="LOINC code">
        <Input placeholder="8480-6" {...field("loinc_code")} />
      </Labeled>
      <Labeled label="Value">
        <Input type="number" step="any" {...field("value")} />
      </Labeled>
      <Labeled label="Unit">
        <Input placeholder="mmHg" {...field("unit")} />
      </Labeled>
      <Labeled label="Recorded">
        <Input type="date" {...field("recorded_at")} />
      </Labeled>
    </div>
  );
}

function PrescriptionForm({ field }: { field: FieldFn }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Labeled label="Drug name">
        <Input placeholder="Amoxicillin" {...field("drug_name")} />
      </Labeled>
      <Labeled label="ATC code">
        <Input placeholder="J01CA04" {...field("atc_code")} />
      </Labeled>
      <Labeled label="Dosage">
        <Input placeholder="500 mg" {...field("dosage")} />
      </Labeled>
      <Labeled label="Frequency">
        <Input placeholder="3× daily" {...field("frequency")} />
      </Labeled>
      <Labeled label="Start date">
        <Input type="date" {...field("start_date")} />
      </Labeled>
      <Labeled label="End date">
        <Input type="date" {...field("end_date")} />
      </Labeled>
    </div>
  );
}

function RecordForm({
  field,
  draft,
  setDraft,
}: {
  field: FieldFn;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const pick = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Labeled label="Description" className="sm:col-span-2">
        <Input placeholder="Community-acquired pneumonia" {...field("description")} />
      </Labeled>
      <Labeled label="Category">
        <Picker
          value={draft["category"] ?? "CONDITION"}
          onChange={(v) => pick("category", v)}
          options={RECORD_CATEGORIES}
        />
      </Labeled>
      <Labeled label="Status">
        <Picker
          value={draft["status"] ?? "ACTIVE"}
          onChange={(v) => pick("status", v)}
          options={RECORD_STATUSES}
        />
      </Labeled>
      <Labeled label="Code system">
        <Picker
          value={draft["code_system"] ?? "ICD10"}
          onChange={(v) => pick("code_system", v)}
          options={CODE_SYSTEMS}
        />
      </Labeled>
      <Labeled label="Code">
        <Input placeholder="J18.9" {...field("code")} />
      </Labeled>
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o.charAt(0) + o.slice(1).toLowerCase().replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Labeled({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({
  title,
  canEdit,
  onAdd,
  children,
}: {
  title: string;
  canEdit: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {canEdit ? (
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={onAdd}>
            <Plus className="size-4" />
            Add
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ItemsTable({
  headers,
  canEdit,
  empty,
  emptyText,
  children,
}: {
  headers: string[];
  canEdit: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h} className="whitespace-nowrap text-xs">
                {h}
              </TableHead>
            ))}
            {canEdit ? <TableHead className="w-[90px]" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {empty ? (
            <TableRow>
              <TableCell
                colSpan={headers.length + (canEdit ? 1 : 0)}
                className="text-sm text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : null}
          {children}
        </TableBody>
      </Table>
    </div>
  );
}

function EditRow({ span, children }: { span: number; children: React.ReactNode }) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={span} className="space-y-2 py-3">
        {children}
      </TableCell>
    </TableRow>
  );
}

function Row({
  cells,
  canEdit,
  onEdit,
  onDelete,
}: {
  cells: React.ReactNode[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <TableRow>
      {cells.map((c, i) => (
        <TableCell
          key={i}
          className={i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          {c}
        </TableCell>
      ))}
      {canEdit ? (
        <TableCell className="text-right">
          {confirming ? (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2"
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onEdit}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

