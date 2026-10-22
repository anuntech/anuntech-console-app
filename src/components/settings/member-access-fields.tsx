"use client";
import { useId, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductIcon } from "@/components/console/product-icon";
import { engagementLabels } from "@/lib/format";
import { scopeSummary } from "@/lib/access/scope-summary";

/** A product, service or project of the company, as the picker lists it. */
export type ScopeEngagement = {
  id: string;
  name: string;
  kind: "product" | "service" | "project";
  status: string;
  icon: string | null;
};

export type MemberScope = { access: "all" | "selected"; ids: string[] };

const choice =
  "group flex cursor-pointer items-start gap-3 rounded-lg border bg-field px-3 py-2.5 text-sm transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

/** The radio's dot, drawn here: the input itself stays hidden (the old global input styles distort it). */
function Dot() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background group-has-[:checked]:border-primary"
    >
      <span className="size-2 rounded-full bg-primary opacity-0 group-has-[:checked]:opacity-100" />
    </span>
  );
}

const groups = [
  { label: "Projetos", kinds: ["project"] },
  { label: "Produtos e serviços", kinds: ["product", "service"] },
] as const;

// The wording lives in lib, where the app's API reads it too.
export { scopeSummary };

/**
 * "O que esta pessoa vê": everything of the company, or only the products,
 * services and projects ticked here. Sends `engagementAccess` and every ticked
 * `engagementIds`; the server checks each id belongs to the company.
 */
export function EngagementScopeField({
  engagements,
  defaultValue = { access: "all", ids: [] },
  hideLegend = false,
}: {
  engagements: ScopeEngagement[];
  defaultValue?: MemberScope;
  /** In a dialog already titled "O que esta pessoa vê", the legend is only for screen readers. */
  hideLegend?: boolean;
}) {
  const id = useId();
  const [access, setAccess] = useState(defaultValue.access);
  const [ids, setIds] = useState(() => new Set(defaultValue.ids));
  const toggle = (engagementId: string, on: boolean) =>
    setIds((current) => {
      const next = new Set(current);
      if (on) next.add(engagementId);
      else next.delete(engagementId);
      return next;
    });
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm font-medium text-foreground"}>O que esta pessoa vê</legend>
      <label className={choice}>
        <input
          type="radio"
          name="engagementAccess"
          value="all"
          checked={access === "all"}
          onChange={() => setAccess("all")}
          className="sr-only"
        />
        <Dot />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Tudo da empresa</span>
          <span className="block text-xs text-muted-foreground">Produtos, serviços e projetos, também os que entrarem depois.</span>
        </span>
      </label>
      <label className={choice}>
        <input
          type="radio"
          name="engagementAccess"
          value="selected"
          checked={access === "selected"}
          onChange={() => setAccess("selected")}
          className="sr-only"
        />
        <Dot />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Só o que eu escolher</span>
          <span className="block text-xs text-muted-foreground">Os outros itens e os chamados sobre eles ficam fora da visão dela.</span>
        </span>
      </label>
      {access === "selected" &&
        (engagements.length ? (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span aria-live="polite">
                {ids.size} de {engagements.length} {engagements.length === 1 ? "escolhido" : "escolhidos"}
              </span>
              <span className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIds(new Set(engagements.map((e) => e.id)))}>
                  Marcar todos
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIds(new Set())}>
                  Limpar
                </Button>
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto overscroll-contain rounded-lg border">
              {groups.map((group) => {
                const items = engagements.filter((e) => (group.kinds as readonly string[]).includes(e.kind));
                if (!items.length) return null;
                return (
                  <div key={group.label} role="group" aria-labelledby={`${id}-${group.kinds[0]}`}>
                    <p id={`${id}-${group.kinds[0]}`} className="m-0 border-b bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </p>
                    <ul className="m-0 list-none divide-y p-0">
                      {items.map((engagement) => (
                        <li key={engagement.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/40 has-[:focus-visible]:bg-accent/40">
                            <Checkbox
                              name="engagementIds"
                              value={engagement.id}
                              checked={ids.has(engagement.id)}
                              onCheckedChange={(checked) => toggle(engagement.id, checked === true)}
                              aria-label={engagement.name}
                            />
                            <ProductIcon src={engagement.icon} name={engagement.name} size={24} />
                            <span className="min-w-0 flex-1 truncate text-foreground">{engagement.name}</span>
                            {engagement.status !== "active" && (
                              <span className="shrink-0 text-xs text-muted-foreground">{engagementLabels[engagement.status] ?? engagement.status}</span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className={cn("m-0 text-xs", ids.size ? "text-muted-foreground" : "text-warning")}>
              {ids.size
                ? "Itens novos só aparecem para esta pessoa quando você marcar aqui. Chamados sem produto e bookmarks continuam visíveis."
                : "Sem nada marcado, a pessoa só vê chamados sem produto e bookmarks."}
            </p>
          </div>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">A empresa ainda não tem produtos, serviços ou projetos para escolher.</p>
        ))}
    </fieldset>
  );
}
