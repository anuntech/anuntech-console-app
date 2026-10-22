import Link from "next/link";
import { ChevronRightIcon, CircleDashedIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { PixelProgress } from "@/components/console/pixel-progress";
import { ONBOARDING_SLOTS, onboardingSlot, type OnboardingStep } from "@/lib/companies/onboarding";

/** Staff: what a client still needs before the relationship runs on its own; only what is missing. */
export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
  if (!steps.length) return null;
  // Steps that are stages of one slot (invited, then signed in) count once.
  const missing = new Set(steps.map((step) => onboardingSlot(step.key))).size;
  const done = Math.max(0, ONBOARDING_SLOTS.length - missing);
  return (
    <Card variant="quiet" className="gap-4 py-5">
      <CardHeader>
        <SectionTitle title="Implantação" description={steps.length === 1 ? "Falta 1 passo." : `Faltam ${steps.length} passos.`} />
        {/* "Da planilha ao produto": one pixel per step, violet once it is done. */}
        <PixelProgress done={done} total={ONBOARDING_SLOTS.length} label="Implantação" className="mt-1 gap-1.5 [&>span]:size-3" />
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 px-3">
        {steps.map((step) =>
          step.href ? (
            <Link
              key={step.key}
              href={step.href}
              className="group/step flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-card focus-visible:bg-card"
            >
              <CircleDashedIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/step:text-primary" />
              <span className="min-w-0 flex-1">{step.label}</span>
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover/step:text-primary" />
            </Link>
          ) : (
            // Happens on the client's side: no link, so it reads as waiting rather than a task.
            <p key={step.key} className="m-0 flex min-h-10 items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
              <CircleDashedIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0">{step.label}</span>
            </p>
          ),
        )}
      </CardContent>
    </Card>
  );
}
