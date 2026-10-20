import { suspensionKindOf, suspensionStage, type SuspensionKind, type SuspensionReason, type SuspensionStage } from "./suspension-rules";

/** An open suspension as the team's list and sheet read it (dates as strings, for the browser). */
export type SuspensionView = {
  id: string;
  stage: SuspensionStage;
  reason: SuspensionReason;
  kind: SuspensionKind;
  scheduledFor: string | null;
  noticeSentAt: string | null;
  suspendedAt: string | null;
  settledAt: string | null;
  note: string | null;
  steps: Record<string, { at: string; by: string }>;
};

type Row = {
  id: string;
  reason: SuspensionReason;
  scheduledFor: string | null;
  noticeSentAt: Date | null;
  suspendedAt: Date | null;
  settledAt: Date | null;
  liftedAt: Date | null;
  note: string | null;
  steps: Record<string, { at: string; by: string }>;
};

/** Staff only: a client learns a product is suspended from its status, never the team's note. */
export function suspensionView(row: Row | undefined, kind: string | null | undefined, admin: boolean): SuspensionView | undefined {
  if (!row || !admin) return undefined;
  return {
    id: row.id,
    stage: suspensionStage(row),
    reason: row.reason,
    kind: suspensionKindOf(kind),
    scheduledFor: row.scheduledFor,
    noticeSentAt: row.noticeSentAt?.toISOString() ?? null,
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    settledAt: row.settledAt?.toISOString() ?? null,
    note: row.note,
    steps: row.steps ?? {},
  };
}
