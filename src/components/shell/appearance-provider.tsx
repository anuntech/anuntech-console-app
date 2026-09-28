"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Theme, DockPosition } from "@/lib/account/appearance";
const AppearanceContext = createContext<{
  theme: Theme;
  position: DockPosition;
  change: (theme: Theme, position: DockPosition) => void;
}>({ theme: "light", position: "bottom", change: () => {} });
export const useAppearance = () => useContext(AppearanceContext);
export function AppearanceProvider({ children, initialTheme, initialPosition }: {
  children: ReactNode; initialTheme: Theme; initialPosition: DockPosition;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [position, setPosition] = useState(initialPosition);
  function change(nextTheme: Theme, nextPosition: DockPosition) {
    setTheme(nextTheme);
    setPosition(nextPosition);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.dock = nextPosition;
    const attributes = `; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.cookie = `console-theme=${nextTheme}${attributes}`;
    document.cookie = `console-dock=${nextPosition}${attributes}`;
  }
  return <AppearanceContext.Provider value={{ theme, position, change }}>{children}</AppearanceContext.Provider>;
}
