"use server";
import { getActor } from "./access";
import {
  interToken,
  flwChannels,
  checkFocus,
  ProviderError,
} from "./integrations";
import type { ActionState } from "./action-state";

export async function checkIntegration(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    switch (form.get("provider")) {
      case "inter":
        await interToken();
        return {
          success:
            "Autenticação e certificado aceitos pelo Inter. Nenhuma cobrança emitida.",
        };
      case "focus":
        await checkFocus("homologation");
        await checkFocus("production");
        return {
          success:
            "Consulta autenticada aceita nos dois ambientes. Emissão ainda depende da configuração fiscal.",
        };
      case "flw": {
        const channels = await flwChannels();
        return channels.length
          ? {
              success: `${channels.length} canal(is) de WhatsApp ativo(s). Nenhuma mensagem enviada.`,
            }
          : { error: "Token aceito, mas nenhum canal de WhatsApp está ativo." };
      }
      default:
        return { error: "Integração inválida." };
    }
  } catch (error) {
    return {
      error:
        error instanceof ProviderError
          ? error.message
          : "Confira as variáveis e a conexão do provedor. Nenhuma operação foi confirmada.",
    };
  }
}
