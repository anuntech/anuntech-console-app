"use client";
import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";

/**
 * A search box that filters while typing: the list gets the text after a
 * short pause, through `onChange`, and the box keeps focus across the
 * refresh. `value` is the text the URL currently holds.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  delay = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
  delay?: number;
}) {
  const [text, setText] = useState(value);
  const [known, setKnown] = useState(value);
  const [emitted, setEmitted] = useState(value);
  // The URL changed from elsewhere (a "Limpar" link, back button): follow it.
  if (value !== known) {
    setKnown(value);
    if (value !== emitted) {
      setEmitted(value);
      setText(value);
    }
  }
  useEffect(() => {
    if (text === emitted) return;
    const timer = setTimeout(() => {
      setEmitted(text);
      onChange(text);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, emitted, delay, onChange]);
  return (
    <div className={cn("relative w-full max-w-sm", className)} role="search">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        inputMode="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        maxLength={160}
        autoComplete="off"
        className={cn("bg-card pl-9", text && "pr-9")}
      />
      {text && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => setText("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
