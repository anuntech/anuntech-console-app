"use client";
import { useState, type ComponentProps } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shell/notifications";

/** Copies `value`; the icon confirms for a moment and a toast names what was copied. */
export function CopyButton({
  value,
  label,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "value"> & {
  value: string;
  /** e.g. "Link de pagamento" → "Link de pagamento copiado." */
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Copiar ${label.toLowerCase()}`}
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado.`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto e copie.");
        }
      }}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      {children}
    </Button>
  );
}
