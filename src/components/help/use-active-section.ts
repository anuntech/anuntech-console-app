"use client";
import { useEffect, useState } from "react";

/**
 * The section being read, for a table of contents: the first of `ids` that
 * crosses the upper part of the window (below the top 10%, above the bottom
 * 65%). Stays on the last one found while the reader is between sections;
 * before any is reached, the first.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    const sections = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = sections.find((el) => visible.has(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-10% 0px -65% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [key]);
  return active ?? ids[0] ?? null;
}
