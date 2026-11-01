"use client";
import { useState, type ComponentProps } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shell/notifications";

/** Copies `value`; the icon confirms for a moment and a toast names what was copied. */
export function CopyButton({
  value,
  label,
  copiedText,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "value"> & {
  value: string;
  /** e.g. "Link de pagamento" → "Link de pagamento copiado." */
  label: string;
  /** The toast when the masculine default does not fit ("Senha copiada."). */
  copiedText?: string;
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
          toast.success(copiedText ?? `${label} copiado.`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto e copie.");
        }
      }}
    >
      {/* Both icons share one cell and crossfade, so quick re-copies retarget instead of popping. */}
      <span className="grid shrink-0 *:col-start-1 *:row-start-1 *:transition-[opacity,transform,filter] *:duration-(--anu-motion-base) motion-reduce:*:transition-none">
        <CopyIcon className={copied ? "scale-50 opacity-0 blur-[2px]" : undefined} />
        <CheckIcon className={copied ? "text-success" : "scale-50 opacity-0 blur-[2px]"} />
      </span>
      {children}
    </Button>
  );
}
