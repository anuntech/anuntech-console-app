import { Notifications } from "@/components/notifications";
import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { AppearanceProvider } from "@/components/appearance-provider";
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
        <a className="skip-link" href="#main-content">
          Ir para o conteúdo
        </a>
        {children}
        <Notifications />
        </AppearanceProvider>
      </body>
    </html>
  );
}
