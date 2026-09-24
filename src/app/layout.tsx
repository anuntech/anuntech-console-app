import { Notifications } from "@/components/notifications";
import type { Metadata } from "next";
import Script from "next/script";
import "./shadcn.css";
import "./globals.css";
import { cookies } from "next/headers";
import { AppearanceProvider } from "@/components/appearance-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { parseTheme, parseDockPosition } from "@/lib/appearance";
export const metadata: Metadata = {
  title: { default: "Anuntech Console", template: "%s | Anuntech Console" },
  description: "Portal do cliente Anuntech.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const theme = parseTheme(store.get("console-theme")?.value);
  const position = parseDockPosition(store.get("console-dock")?.value);
  return (
    <html lang="pt-BR" data-theme={theme} data-dock={position}>
      <body>
        <AppearanceProvider initialTheme={theme} initialPosition={position}>
          <TooltipProvider delayDuration={350}>
            <a className="skip-link" href="#main-content">
              Ir para o conteúdo
            </a>
            {children}
            <Notifications />
          </TooltipProvider>
        </AppearanceProvider>
        {/* Synova support widget; the vendor limits it to console.anuntech.com, so only production loads it. */}
        {process.env.NODE_ENV === "production" && (
          <>
            {/* The widget binds to this at boot; every "Falar com o suporte" button clicks it. */}
            <button type="button" id="support-widget-trigger" className="h-widget-trigger" hidden tabIndex={-1} aria-hidden="true" />
            <Script
              src="https://cdn.wts.chat/scripts/widget/v3/h-widget-min.js"
              data-widget="copia-de-support-nova-versao-538d23"
              strategy="afterInteractive"
            />
          </>
        )}
      </body>
    </html>
  );
}
