import { NewTicketSheet } from "@/components/chamados/ticket-sheet";
import {
  newTicketContext,
  type NewTicketSearchParams,
} from "@/components/chamados/new-ticket-context";
export const metadata = { title: "Novo chamado" };
export default async function Page({
  searchParams,
}: {
  searchParams: NewTicketSearchParams;
}) {
  return <NewTicketSheet context={await newTicketContext(searchParams)} />;
}
