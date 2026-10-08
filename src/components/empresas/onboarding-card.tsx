import Link from "next/link";
import { CircleDashedIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import type { OnboardingStep } from "@/lib/companies/onboarding";

/** Staff: what a client still needs before the relationship runs on its own; only what is missing. */
export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
  if (!steps.length) return null;
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Implantação" description={steps.length === 1 ? "Falta 1 passo." : `Faltam ${steps.length} passos.`} />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">{step.label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
