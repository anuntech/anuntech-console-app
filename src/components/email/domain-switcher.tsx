"use client";
import { usePathname, useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type DomainChoice = { domain: string; companyName: string };

/**
 * Which managed domain the page shows (`?dominio=`): Anuntech's and each
 * client's. With a single domain there is nothing to choose, so it hides.
 */
export function DomainSwitcher({ choices, current }: { choices: DomainChoice[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const id = useId();
  if (choices.length < 2) return null;
  return (
    // The select's own wrapper takes the full width; this one sets it beside the buttons.
    <div className="w-full sm:w-64">
      <label htmlFor={id} className="sr-only">
        Domínio
      </label>
      <NativeSelect
        id={id}
        value={current}
        disabled={pending}
        onChange={(event) => start(() => router.push(`${pathname}?dominio=${encodeURIComponent(event.target.value)}`))}
      >
        {choices.map((choice) => (
          <NativeSelectOption key={choice.domain} value={choice.domain}>
            {choice.domain} ({choice.companyName})
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
