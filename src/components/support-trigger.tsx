"use client";
import type { ReactNode } from "react";
import { toast } from "@/components/notifications";

export const SUPPORT_TRIGGER_ID = "support-widget-trigger";

/**
 * Opens the Synova support widget through the one element it bound to at
 * boot (see the root layout), so it works from any page and after client
 * navigations too. Outside production there is no widget to open.
 */
export function openSupportWidget() {
  const trigger = document.getElementById(SUPPORT_TRIGGER_ID);
  if (trigger) trigger.click();
  else toast.error("O chat de suporte não está disponível neste ambiente.");
}

export function SupportButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={openSupportWidget}>
      {children}
    </button>
  );
}
