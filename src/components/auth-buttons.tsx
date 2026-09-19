"use client";
import { Notification, toast } from "./notifications";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LogOut, ArrowRight } from "lucide-react";
export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button google"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await authClient.signIn.social({
              provider: "google",
              callbackURL: "/painel",
              errorCallbackURL: "/entrar?erro=acesso",
            });
            if (result.error) {
              setError("Não foi possível iniciar o acesso. Tente novamente.");
              setPending(false);
            }
          } catch {
            setError("Não foi possível conectar. Tente novamente.");
            setPending(false);
          }
        }}
      >
        <span className="google-letter">G</span>
        {pending ? "Conectando…" : "Continuar com Google"}
        <ArrowRight size={17} />
      </button>
      {error && <Notification kind="error" message={error} />}
    </>
  );
}
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      <button
        className="signout"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await authClient.signOut();
            if (result.error) throw Error();
            toast.success("Você saiu da Console.");
            router.replace("/entrar");
            router.refresh();
          } catch {
            setPending(false);
            setError(true);
          }
        }}
      >
        <LogOut size={16} />
        {pending ? "Saindo…" : "Sair"}
      </button>
      {error && (
        <Notification
          kind="error"
          message="Não foi possível sair. Tente novamente."
        />
      )}
    </>
  );
}
