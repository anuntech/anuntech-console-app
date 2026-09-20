import { Notifications } from "@/components/notifications";
import type { Metadata } from "next";
import "@daypicker/react/style.css";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Anuntech Console", template: "%s | Anuntech Console" },
  description: "Portal do cliente Anuntech.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main-content">
          Ir para o conteúdo
        </a>
        {children}
        <Notifications />
      </body>
    </html>
  );
}
