"use client";
import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONEY_COOKIE } from "@/lib/money-visibility";

/** Shows or hides the values of every MoneyScope on the page, and remembers the choice. */
export function MoneyToggle({ hidden: initial }: { hidden: boolean }) {
  const [hidden, setHidden] = useState(initial);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    for (const scope of document.querySelectorAll("[data-money-scope]")) scope.toggleAttribute("data-money-hidden", next);
    document.cookie = `${MONEY_COOKIE}=${next ? "hidden" : "shown"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  };
  const label = hidden ? "Mostrar valores" : "Esconder valores";
  return (
    <Button type="button" variant="outline" size="icon" onClick={toggle} aria-pressed={!hidden} aria-label={label} title={label}>
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </Button>
  );
}
