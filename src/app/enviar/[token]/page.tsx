import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { StatusPage } from "@/components/console/status-page";
import { ShareFrame } from "@/components/arquivos/share-frame";
import { ShareUnlock } from "@/components/arquivos/share-unlock";
import { RequestUpload } from "@/components/arquivos/request-upload";
import { linkByToken, linkOwner, unlockCookieName, unlocked } from "@/lib/drive/share-links";
import { shareClosedText, shareState } from "@/lib/drive/share-rules";
export const dynamic = "force-dynamic";
export const metadata = { title: "Enviar arquivos", robots: { index: false, follow: false, noarchive: true } };

/** A request link (Arquivos): anyone with the address sends files into the folder; nothing already there shows. */
export default async function SendFiles({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await linkByToken(token);
  if (!link || link.kind !== "request") notFound();
  const state = shareState(link);
  if (state !== "active")
    return <StatusPage art="busca" eyebrow="Pedido de arquivos" title="Este link não recebe mais arquivos" description={shareClosedText[state]} />;
  const owner = await linkOwner(link);
  const open = unlocked(link, (await cookies()).get(unlockCookieName(link))?.value);
  return (
    <ShareFrame
      eyebrow={`${owner} pediu que você envie arquivos`}
      title={link.title}
      description={link.expiresAt ? `O link recebe arquivos até ${link.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Você não vê o que já foi enviado.` : "Você não vê o que já foi enviado."}
    >
      {open ? <RequestUpload token={token} /> : <ShareUnlock token={token} />}
    </ShareFrame>
  );
}
