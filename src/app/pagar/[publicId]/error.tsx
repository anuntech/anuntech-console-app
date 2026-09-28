"use client";
import { ErrorView, type ErrorBoundaryProps } from "@/components/console/error-view";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";

/** The payment page failed to render; whoever pays has no login, so help is WhatsApp. */
export default function PaymentError(props: ErrorBoundaryProps) {
  return (
    <>
      <title>Pagamento indisponível | Anuntech Console</title>
      <ErrorView
        {...props}
        home={null}
        help={
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
            Falar com a Anuntech no WhatsApp
          </a>
        }
      />
    </>
  );
}
