import { invoiceLook } from "@/lib/status";
import { Pill } from "./pill";

/** An invoice's situation: open blue, overdue red, paid green, the rest grey. */
export function InvoiceBadge({ display, label }: { display: string; label: string }) {
  const look = invoiceLook[display] ?? invoiceLook.scheduled;
  return <Pill label={label} tone={look.tone} icon={look.icon} />;
}
