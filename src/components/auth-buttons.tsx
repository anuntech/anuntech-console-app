"use client";
import { Notification } from "./notifications";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const feedbackId = useId();
  return (
    <>
      <button
        className="signout"
        type="button"
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
        <LogOut size={16} aria-hidden="true" />
        {pending ? "Saindo…" : "Sair"}
      </button>
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
