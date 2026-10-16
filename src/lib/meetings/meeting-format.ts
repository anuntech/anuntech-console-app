/** How a meeting reads on screen. Pure and client-safe (no Node APIs), for the list and the reader. */

/** "42 min", "1 h 05 min", "2 h". */
export function durationLabel(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${hours} h`;
}
