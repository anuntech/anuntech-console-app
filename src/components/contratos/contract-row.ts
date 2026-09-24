import type { ContractKind, ContractStatus } from "@/lib/contract-table";

/** One contract as the lists show it; amendments carry their parent. */
export type ContractRow = {
  id: string;
  title: string;
  kind: ContractKind;
  parentId: string | null;
  parentTitle: string | null;
  companyId: string;
  company: string;
  engagement: string | null;
  status: ContractStatus;
  startsAt: string | null;
  endsAt: string | null;
  signedBy: ("client" | "anuntech")[];
  updatedAt: string;
};

/** Contracts with their amendments nested, in the order the rows came. */
export function groupContracts(rows: ContractRow[]) {
  const roots = new Map<string, { contract: ContractRow; amendments: ContractRow[] }>();
  for (const row of rows) if (row.kind === "contract") roots.set(row.id, { contract: row, amendments: [] });
  const orphans: ContractRow[] = [];
  for (const row of rows) {
    if (row.kind !== "amendment") continue;
    const parent = row.parentId ? roots.get(row.parentId) : undefined;
    if (parent) parent.amendments.push(row);
    else orphans.push(row);
  }
  return {
    groups: [...roots.values()],
    /** Amendments whose contract fell outside the current filter. */
    orphans,
  };
}
