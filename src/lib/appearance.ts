export const themes = ["light", "dark", "system"] as const;
export const dockPositions = ["bottom", "top", "left", "right"] as const;
export type Theme = (typeof themes)[number];
export type DockPosition = (typeof dockPositions)[number];
export function parseTheme(value?: string): Theme {
  return themes.includes(value as Theme) ? value as Theme : "light";
}
export function parseDockPosition(value?: string): DockPosition {
  return dockPositions.includes(value as DockPosition) ? value as DockPosition : "bottom";
}
