"use client";
import { useState } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Point = { title: string; where: string; issue: string; suggestion: string; level: "alta" | "media" | "baixa" };

const LEVEL: Record<Point["level"], { label: string; className: string }> = {
  alta: { label: "Importante", className: "bg-destructive-soft text-destructive" },
  media: { label: "Vale ajustar", className: "bg-warning-soft text-warning" },
  baixa: { label: "Detalhe", className: "bg-secondary text-muted-foreground" },
};

/**
 * "Revisar com IA": what could be better in the saved draft, compared with the proposal and the
 * project. Points to look at, on screen only; the team decides and edits the text.
 */
export function ContractAiReview({ contractId }: { contractId: string }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const review = async () => {
    setBusy(true);
    setMessage("Lendo o contrato, o orçamento e a jornada…");
    try {
      const response = await fetch(`/api/contratos/${contractId}/revisao`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { points?: Point[]; error?: string } | null;
      if (!response.ok || !data?.points) throw new Error(data?.error || "Não foi possível revisar agora.");
      setPoints(data.points);
      setMessage(data.points.length ? "" : "Nada importante para ajustar no texto salvo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível revisar agora.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="contract-ai-review-title" className="rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <h3 id="contract-ai-review-title" className="m-0 text-sm font-semibold text-foreground">
            O que dá para melhorar
          </h3>
          <p className="m-0 mt-0.5 text-xs text-muted-foreground">
            A IA compara o texto salvo com o orçamento e a jornada e aponta divergências, cláusulas que não combinam com o projeto e
            riscos. Confira cada ponto: não é parecer jurídico.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void review()}>
          {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {busy ? "Revisando…" : points ? "Revisar de novo" : "Revisar com IA"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={cn("m-0 text-xs text-muted-foreground", message && "mt-3")}>
        {message}
      </p>
      {points && points.length > 0 && (
        <ol className="m-0 mt-4 flex list-none flex-col divide-y p-0">
          {points.map((point, index) => (
            <li key={index} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", LEVEL[point.level].className)}>{LEVEL[point.level].label}</span>
                <p className="m-0 text-sm font-medium text-foreground">{point.title}</p>
                {point.where && <span className="text-xs text-muted-foreground">{point.where}</span>}
              </div>
              <p className="m-0 mt-1 text-sm text-muted-foreground">{point.issue}</p>
              <p className="m-0 mt-1 text-sm text-foreground">
                <span className="font-medium">Sugestão: </span>
                {point.suggestion}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
