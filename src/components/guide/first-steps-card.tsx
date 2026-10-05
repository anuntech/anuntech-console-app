"use client";
import Link from "next/link";
import { useEffect, useTransition } from "react";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { markFirstStep } from "@/lib/guide/milestone-actions";
import type { FirstSteps } from "@/lib/guide/first-steps";

/** "Primeiros passos": a short checklist on the overview; it leaves once done or hidden. */
export function FirstStepsCard({ data }: { data: FirstSteps }) {
  const [pending, start] = useTransition();
  const done = data.steps.filter((s) => s.done).length;
  return (
    <section aria-label="Primeiros passos" className="mb-6 rounded-xl border bg-card shadow-card">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <h2 className="m-0 text-[15px] leading-6 font-semibold text-foreground">Primeiros passos</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground tabular-nums">
          {done} de {data.steps.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          disabled={pending}
          onClick={() => start(() => markFirstStep(data.companyId, "first_steps_hidden"))}
        >
          Ocultar
        </Button>
      </div>
      <ul className="m-0 list-none divide-y p-0">
        {data.steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="group flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3",
                  step.done ? "border-success bg-success text-white" : "border-muted-foreground/40",
                )}
              >
                {step.done && <CheckIcon />}
              </span>
              <span className={cn("min-w-0 flex-1", step.done ? "text-muted-foreground line-through" : "text-foreground group-hover:text-primary")}>
                {step.title}
                <span className="sr-only">{step.done ? " (feito)" : ""}</span>
              </span>
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Marks a first step done when the person opens the page that does it (Membros, Notificações). */
export function MarkFirstStep({ companyId, step }: { companyId: string | null; step: "members_reviewed" | "notices_reviewed" }) {
  useEffect(() => {
    if (companyId) void markFirstStep(companyId, step);
  }, [companyId, step]);
  return null;
}
