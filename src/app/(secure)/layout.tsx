import { getActor, allowedIds } from "@/lib/access/access";
import { Dock } from "@/components/shell/dock";
import { redirect } from "next/navigation";
import { canManageMembers } from "@/lib/access/member-access";
import { ServerForm, SubmitButton } from "@/components/console/server-form";
import { endAssistedSession } from "@/lib/access/assisted-actions";
import { voiceEnabled } from "@/lib/voice/voice-server";
import { ConsoleOpening } from "@/components/shell/console-opening";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function ConsoleLayout({
  children,
  ticket,
}: {
  children: React.ReactNode;
  /** Intercepted "new" routes: sheets that slide over the current page. */
  ticket: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor.admin && !actor.grants.length && !actor.assisting)
    redirect("/acesso-pendente");
  return (
    <>
      <ConsoleOpening />
      {actor.assisting && (
        <div
          role="status"
          className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-warning-edge bg-warning-soft px-5 py-2.5 text-center text-[13px] text-warning"
        >
          <span>
            Modo assistido: você está vendo o Console como{" "}
            <strong className="font-semibold">{actor.assisting.name}</strong>.
          </span>
          <ServerForm action={endAssistedSession}>
            <SubmitButton
              size="sm"
              variant="outline"
              pendingLabel="Saindo…"
              className="border-warning-edge text-foreground"
            >
              Sair do modo assistido
            </SubmitButton>
          </ServerForm>
        </div>
      )}
      <div className="console-shell">
        <div className="workspace">
          <Dock
            userName={actor.user.name}
            userImage={actor.user.image ?? null}
            canManageMembers={canManageMembers(actor)}
            admin={actor.admin}
            support={!!allowedIds(actor, "support").length}
            finance={!!allowedIds(actor, "finance").length}
            voice={voiceEnabled()}
          />
          <main className="page-content" id="main-content" tabIndex={-1}>
            {children}
          </main>
          {ticket}
        </div>
      </div>
    </>
  );
}
