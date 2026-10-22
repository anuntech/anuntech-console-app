"use client";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { useAppearance } from "@/components/shell/appearance-provider";
import { toast } from "@/components/shell/notifications";
import type { DockPosition, Theme } from "@/lib/account/appearance";

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", icon: <SunIcon /> },
  { value: "dark", label: "Escuro", icon: <MoonIcon /> },
  { value: "system", label: "Sistema", icon: <MonitorIcon /> },
];
const POSITIONS: { value: DockPosition; label: string }[] = [
  { value: "bottom", label: "Embaixo" },
  { value: "top", label: "Em cima" },
  { value: "left", label: "À esquerda" },
  { value: "right", label: "À direita" },
];

const choice =
  "flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-field px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

/** A tiny picture of where the dock sits; the bar is the dock. */
function DockPreview({ position }: { position: DockPosition }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-10 w-14 rounded-md border bg-background"
    >
      <span
        className={cn(
          "absolute rounded-full bg-primary/70",
          position === "bottom" && "inset-x-3 bottom-1.5 h-1.5",
          position === "top" && "inset-x-3 top-1.5 h-1.5",
          position === "left" && "inset-y-2 left-1.5 w-1.5",
          position === "right" && "inset-y-2 right-1.5 w-1.5",
        )}
      />
    </span>
  );
}

export function AppearanceSection() {
  const { theme, position, change } = useAppearance();
  function choose(nextTheme: Theme, nextPosition: DockPosition) {
    change(nextTheme, nextPosition);
    toast.success("Aparência atualizada.", { id: "appearance-saved" });
  }
  return (
    <>
      <Card>
        <CardHeader>
          <SectionTitle title="Tema" />
        </CardHeader>
        <CardContent>
          <fieldset className="grid grid-cols-3 gap-2 sm:max-w-md">
            <legend className="sr-only">Tema</legend>
            {THEMES.map((option) => (
              <label key={option.value} className={cn(choice, "[&_svg]:size-5")}>
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  className="sr-only"
                  checked={theme === option.value}
                  onChange={() => choose(option.value, position)}
                />
                {option.icon}
                {option.label}
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <SectionTitle title="Posição do menu" />
        </CardHeader>
        <CardContent>
          <fieldset className="grid grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
            <legend className="sr-only">Posição do menu</legend>
            {POSITIONS.map((option) => (
              <label key={option.value} className={choice}>
                <input
                  type="radio"
                  name="dock-position"
                  value={option.value}
                  className="sr-only"
                  checked={position === option.value}
                  onChange={() => choose(theme, option.value)}
                />
                <DockPreview position={option.value} />
                {option.label}
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>
    </>
  );
}
