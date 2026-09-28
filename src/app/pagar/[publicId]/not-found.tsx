import { MessageCircleIcon, ReceiptTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/console/status-page";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";

export const metadata = {
  title: "Link de pagamento indisponível",
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * A payment link that opens nothing: wrong, turned off, or replaced by a new
 * charge. Whoever pays has no login, so the way out is the Anuntech team.
 */
export default function PaymentNotFound() {
  return (
    <StatusPage
      icon={<ReceiptTextIcon />}
      eyebrow="Link de pagamento"
      title="Este link não abre nenhuma fatura"
      description="Ele pode ter sido desativado ou trocado por um novo, ou o endereço chegou incompleto. Fale com a Anuntech para receber o link da sua fatura."
      actions={
        <Button asChild>
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircleIcon />
            Falar com a Anuntech no WhatsApp
          </a>
        </Button>
      }
    />
  );
}
