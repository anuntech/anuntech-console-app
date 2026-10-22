import type { ContractKind, ContractStatus } from "@/lib/contracts/contract-table";

/** One contract as the lists show it; amendments carry their parent. */
export type ContractRow = {
  id: string;
  title: string;
  kind: ContractKind;
  parentId: string | null;
  parentTitle: string | null;
  companyId: string;
  /** Razão social, as stored; lists show its display name. */
  company: string;
  /** CNPJ/CPF, so a MEI's number can come off its name on screen. */
  companyDocument?: string | null;
  engagement: string | null;
  status: ContractStatus;
  startsAt: string | null;
  endsAt: string | null;
  signedBy: ("client" | "anuntech")[];
  updatedAt: string;
};
