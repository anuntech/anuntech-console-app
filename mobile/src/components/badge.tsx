import { ticketLook } from "@/lib/status";
import { Pill } from "./pill";

/** A ticket's situation: what needs the team blue, the client amber, done green, over grey. */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  const look = ticketLook[status] ?? ticketLook.open;
  return <Pill label={label} tone={look.tone} icon={look.icon} />;
}
