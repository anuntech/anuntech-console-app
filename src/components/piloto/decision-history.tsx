import { Card, CardContent } from "@/components/ui/card";
import { dateTimeLabel } from "@/lib/format";

export type HistoryItem = {
  id: string;
  title: string;
  company: string | null;
  status: "pending" | "done" | "dismissed" | "expired";
  resolution: "queue" | "elsewhere" | "mixed" | null;
  dismissReason: string | null;
  decidedAt: string | null;
};

const outcome = (item: HistoryItem) =>
  item.status === "dismissed"
    ? `Dispensada${item.dismissReason ? `: ${item.dismissReason}` : ""}`
    : item.status === "expired"
      ? "Venceu sem resposta"
      : item.resolution === "queue"
        ? "Resolvida pela fila"
        : item.resolution === "mixed"
          ? "Resolvida pela fila e pelas telas"
          : "Resolvida pelas telas";

/** The latest finished decisions and how each ended. */
export function DecisionHistory({ items }: { items: HistoryItem[] }) {
  return (
    <Card className="py-2">
      <CardContent className="px-0">
        <ul className="m-0 grid list-none p-0">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t px-6 py-2.5 text-sm first:border-t-0">
              <span className="min-w-0">
                <span className="block text-foreground">{item.title}</span>
                <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{outcome(item)}</span>
              </span>
              {item.decidedAt && <span className="text-xs text-muted-foreground tabular-nums">{dateTimeLabel(item.decidedAt)}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
