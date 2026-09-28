"use client";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Back where the person came from; a page opened straight from a link has nowhere to go back to, so it goes to `fallback`. */
export function BackButton({ fallback = "/painel", label = "Voltar" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <Button type="button" variant="outline" onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}>
      <ArrowLeftIcon />
      {label}
    </Button>
  );
}
