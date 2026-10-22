import { contractBlocks, diffBlocks, requestable, type ContractBlock } from "./contract-text";

/*
 * The contract text and its review as the app reads them, worked out on the
 * server from the same rules the web's ContractText and contract-review use:
 * which blocks a client can ask to change (and their position, which a
 * request names), what changed since the previous version, and the requests
 * of the round in front of the client apart from the earlier rounds.
 */

export type ReviewBlock = {
  /** The block's position in the text shown (what a request names); null for a block the new version removed. */
  index: number | null;
  type: ContractBlock["type"];
  /** "1.1" for a clause, "CONTRATANTE" for a party; null otherwise. */
  number: string | null;
  label: string | null;
  text: string;
  /** Same as the web: changed blocks count as added; removed ones stay where they were. */
  change: "same" | "added" | "removed";
  requestable: boolean;
};

/** The shown text's blocks in order, marked against the previous version when there is one. */
export function reviewBlocks(body: string, previousBody: string | null): ReviewBlock[] {
  const blocks = contractBlocks(body);
  const entries = previousBody
    ? diffBlocks(contractBlocks(previousBody), blocks)
    : blocks.map((block, index) => ({ block, change: "same" as const, index }));
  return entries.map((entry) => ({
    index: entry.change === "removed" ? null : (entry.index ?? null),
    type: entry.block.type,
    number: entry.block.type === "clause" ? entry.block.number : null,
    label: entry.block.type === "party" ? entry.block.label : null,
    text: entry.block.text,
    change: entry.change,
    requestable: entry.change !== "removed" && requestable(entry.block),
  }));
}

type Request = { version: number; status: string; blockIndex: number };

/**
 * The requests of the version shown (the client's drafts included, when the
 * caller's list has them) and the earlier rounds, newest first, without
 * drafts: the web's useClientReview and ReviewHistory.
 */
export function reviewRounds<R extends Request>(requests: R[], version: number) {
  const current = requests.filter((r) => r.version === version);
  const rounds = new Map<number, R[]>();
  for (const request of requests)
    if (request.version < version && request.status !== "draft")
      rounds.set(request.version, [...(rounds.get(request.version) ?? []), request]);
  return {
    current,
    drafts: current.filter((r) => r.status === "draft").length,
    history: [...rounds.entries()]
      .sort(([a], [b]) => b - a)
      .map(([round, items]) => ({ version: round, requests: [...items].sort((a, b) => a.blockIndex - b.blockIndex) })),
  };
}

export const changeRequestStatusLabels: Record<string, string> = {
  draft: "Não enviado",
  pending: "Aguardando a Anuntech",
  accepted: "Aceito",
  declined: "Recusado",
};
