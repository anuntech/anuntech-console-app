"use client";
import { Notification } from "../shell/notifications";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const feedbackId = useId();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        aria-disabled={pending}
        aria-describedby={error ? feedbackId : undefined}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setError(false);
          try {
            const result = await authClient.signOut();
            if (result.error) throw Error();
            router.replace("/entrar");
            router.refresh();
          } catch {
            setPending(false);
            setError(true);
          }
        }}
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
        {pending ? "Saindo…" : "Sair"}
      </Button>
      {error && (
        <Notification
          id={feedbackId}
          kind="error"
          message="Não foi possível sair. Tente novamente."
        />
      )}
    </>
  );
}
