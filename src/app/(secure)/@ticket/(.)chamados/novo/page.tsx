import { NewTicketPage } from "@/components/new-ticket-page";
export const metadata = { title: "Abrir chamado" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; from?: string }>;
}) {
  return <NewTicketPage searchParams={searchParams} intercepted />;
}
