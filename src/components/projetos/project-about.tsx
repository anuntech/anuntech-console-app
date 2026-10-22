"use client";
import Link from "next/link";
import { useState } from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { guideSection } from "@/lib/guide/guide-content";

/** "Sobre este projeto": the objective and how the board works with the team, one tap from the filters. */
export function ProjectAbout({ name, description }: { name: string; description: string | null }) {
  const [open, setOpen] = useState(false);
  const guide = guideSection("projetos");
  const rules = guide?.blocks.flatMap((b) => (b.kind === "list" ? b.items : [])) ?? [];
  return (
    <>
      <Button variant="outline" size="icon" aria-label="Sobre este projeto" title="Sobre este projeto" onClick={() => setOpen(true)}>
        <InfoIcon />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Sobre este projeto</SheetTitle>
            <SheetDescription>{name}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 overflow-y-auto p-4">
            {/* No objective written yet: the section is left out, not filled with a placeholder. */}
            {description?.trim() && (
              <section>
                <h3 className="m-0 mb-1.5 text-sm font-medium text-foreground">Objetivo</h3>
                <p className="m-0 text-sm leading-6 whitespace-pre-wrap text-foreground">{description.trim()}</p>
              </section>
            )}
            <section>
              <h3 className="m-0 mb-1.5 text-sm font-medium text-foreground">Como usar o quadro</h3>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-foreground marker:text-muted-foreground">
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
            <Link href="/como-trabalhamos#projetos" className="text-sm font-medium text-primary hover:underline">
              Como trabalhamos
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
