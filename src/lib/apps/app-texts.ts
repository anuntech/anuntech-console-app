import type { AppBlock } from "./registry";

const statusText: Record<string, string> = { paused: "pausado", completed: "concluído" };

/** What the person reads when a product does not open as an app, and what to do about it. */
export function appBlockText(
  reason: AppBlock | "not_found",
  context: { app?: string; product?: string; company?: string; status?: string } = {},
) {
  const app = context.app ?? "app";
  const company = context.company ?? "sua empresa";
  switch (reason) {
    case "not_found":
    case "not_product":
      return {
        title: "Este app não foi encontrado",
        description: "Ele pode ter sido removido ou não estar entre os produtos das empresas que você acessa.",
      };
    case "not_protected":
      return {
        title: "Este produto abre fora do Console",
        description: "O endereço cadastrado não é de um app que roda dentro do Console.",
      };
    case "inactive":
      // Suspended by Anuntech (late payment, a breach of the terms): the way back is to settle it.
      if (context.status === "suspended")
        return {
          title: `${context.product ?? "Este produto"} está suspenso`,
          description: "Nenhum dado foi apagado. Pague as faturas vencidas em Financeiro ou abra um chamado para falar com a equipe.",
        };
      return {
        title: `${context.product ?? "Este produto"} está ${statusText[context.status ?? ""] ?? "inativo"}`,
        description: "Enquanto isso, o app não abre pelo Console. Fale com a Anuntech para retomar.",
      };
    case "role":
      return {
        title: "Só o Administrador da empresa abre este app",
        description: `Peça a um Administrador da ${company} se você precisar usar o ${app}.`,
      };
    case "no_tenant":
      return {
        title: "Este app ainda não foi liberado para a sua empresa",
        description: `A Anuntech precisa ligar os dados da ${company} ao ${app} antes do primeiro acesso. Abra um chamado se precisar dele agora.`,
      };
  }
}
