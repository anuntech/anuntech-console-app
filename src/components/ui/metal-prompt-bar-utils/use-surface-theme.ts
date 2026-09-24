"use client";
import { useSyncExternalStore } from "react";
import { useAppearance } from "@/components/appearance-provider";

export type SurfaceTheme = "auto" | "light" | "dark";

const query = "(prefers-color-scheme: dark)";
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const getSystem = () => (window.matchMedia(query).matches ? "dark" : "light");
const getServerSystem = () => "light" as const;

/**
 * Resolves the theme the metal ring should paint for. "auto" follows the
 * Console's own appearance setting (light, dark or the OS), so the ring
 * matches the surface it sits on rather than only the OS.
 */
export function useSurfaceTheme(theme: SurfaceTheme = "auto"): "light" | "dark" {
  const { theme: appearance } = useAppearance();
  const system = useSyncExternalStore(subscribe, getSystem, getServerSystem);
  if (theme !== "auto") return theme;
  return appearance === "system" ? system : appearance;
}
