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
