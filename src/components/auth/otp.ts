"use client";
import { useEffect, useState } from "react";

/** Brazilian numbers get the country code; anything starting with + is kept. */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+") ? `+${digits}` : `+55${digits}`;
}

/** One minute between code requests, counted down for the button label. */
export function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, () => setSeconds(60)] as const;
}
