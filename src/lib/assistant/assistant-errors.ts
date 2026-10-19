/** A failure the person reads as it is: in Portuguese, with the next step. */
export class AssistantError extends Error {}

/**
 * How a model call failed: the Gateway's HTTP status (or the code of an
 * error sent after the stream started) and its own words, or a timeout.
 */
export type ProviderFailure = { status?: number; detail: string; timeout?: boolean };

/**
 * The provider's refusal in the words the person reads. The Gateway's own
 * detail (in English) only shows where it names what the model refused.
 */
export function failureText({ status, detail, timeout }: ProviderFailure, model: string): string {
  if (timeout) return "O modelo demorou demais para responder. Tente de novo em instantes.";
  if (status === 401) return "O AI Gateway recusou o acesso do Console. Confira a credencial do projeto na Vercel.";
  // Out of credits (or past the budget set in the dashboard) stops here: no retry spends what is left.
  if (status === 402) return "A conta do AI Gateway está sem créditos. Adicione créditos no painel da Vercel, em AI Gateway, para a IA voltar.";
  if (/data policy|data collection|zero data retention|zdr|no_providers_available|training|privacy/i.test(detail))
    return `Nenhum provedor do modelo "${model}" atende sem guardar os dados. Escolha outro modelo em Configurações › Assistente.`;
  // The free tier and allowlists answer 403 for models outside them.
  if (status === 403)
    return `O AI Gateway não liberou o modelo "${model}" para esta conta. Confira os créditos no painel da Vercel ou escolha outro modelo em Configurações › Assistente.`;
  if (status === 429) return "O modelo está no limite de uso agora. Tente de novo em instantes ou escolha outro modelo em Configurações › Assistente.";
  if (status === 404 || (status !== undefined && /model/i.test(detail))) return `O modelo "${model}" não foi aceito pelo AI Gateway: ${detail}`;
  return `O AI Gateway não respondeu (${detail || (status ? `HTTP ${status}` : "sem detalhe")}). Tente de novo em instantes.`;
}
