"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { issueCode, revokeConnection } from "./meeting-connections";
import { callbackUrl, CHALLENGE } from "./meeting-rules";

/**
 * "Conectar este Mac" on /conectar/<challenge>: the signed-in person approves
 * and the page hands the one-time code to the app through its URL scheme.
 * The key itself only exists after the app proves it holds the verifier.
 */
export async function approveMeetingApp(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const challenge = String(form.get("challenge") ?? "");
  if (!CHALLENGE.test(challenge))
    return { error: "Este link de conexão não é válido. Peça um novo no app, em Conectar ao Console." };
  try {
    const code = await issueCode(actor, challenge);
    return { success: "Pronto. Volte para o app: ele termina a conexão sozinho.", href: callbackUrl(code) };
  } catch {
    return { error: "Não foi possível conectar agora. Tente novamente." };
  }
}

/** "Desconectar" in Configurações → Segurança. */
export async function disconnectMeetingApp(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "App não encontrado." };
  const done = await revokeConnection(actor.user.id, id.data, "console").catch(() => null);
  if (done === null) return { error: "Não foi possível desconectar agora. Tente novamente." };
  if (!done) return { error: "Este app já estava desconectado." };
  revalidatePath("/configuracoes/seguranca");
  return { success: "App desconectado. Ele não salva mais nada na sua conta." };
}
