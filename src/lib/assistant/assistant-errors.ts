/** A failure the person reads as it is: in Portuguese, with the next step. */
export class AssistantError extends Error {}

/**
 * How a model call failed: OpenRouter's HTTP status (or the code of an error
 * it sent after the stream started) and its own words, or a timeout.
 */
export type ProviderFailure = { status?: number; detail: string; timeout?: boolean };

/**
 * The provider's refusal in the words the person reads. OpenRouter's own
 * detail (in English) only shows where it names what the model refused.
 */
export function failureText({ status, detail, timeout }: ProviderFailure, model: string): string {
  if (timeout) return "O modelo demorou demais para responder. Tente de novo em instantes.";
  if (status === 401) return "A chave do OpenRouter foi recusada. Confira em Configurações › Assistente.";
  // Out of credits stops here: no smaller retry that spends what is left.
  if (status === 402) return "A conta do OpenRouter está sem créditos. Adicione créditos em openrouter.ai/settings/credits para o assistente voltar.";
  if (status === 429)
    return "O modelo está no limite de uso do OpenRouter agora. Tente de novo em instantes ou escolha outro modelo em Configurações › Assistente.";
  if (/data policy|data collection|zero data retention|zdr|privacy/i.test(detail))
    return `Nenhum provedor do modelo "${model}" atende sem guardar os dados. Escolha outro modelo em Configurações › Assistente.`;
  if (status === 404 || (status !== undefined && /model/i.test(detail))) return `O modelo "${model}" não foi aceito pelo OpenRouter: ${detail}`;
  return `O OpenRouter não respondeu (${detail || (status ? `HTTP ${status}` : "sem detalhe")}). Tente de novo em instantes.`;
}
