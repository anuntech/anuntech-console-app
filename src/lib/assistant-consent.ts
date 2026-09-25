/**
 * When a reply is already consent. The assistant proposes a change and asks;
 * a plain "sim" right after that question approves what it proposed, with no
 * second opinion. Anything with a condition ("sim, mas só as três primeiras")
 * or a new request is not a plain yes and still goes through the check.
 */

type Turn = { role: string; content: string };

// Whole words, accents included (\b stops at "ó").
const words = (list: string) => new RegExp(`(?<![\\p{L}\\d])(?:${list})(?![\\p{L}\\d])`, "u");
const YES = new RegExp(
  `^${words("sim|s|ok|okay|pode|confirmo|confirmado|confirma|aprovo|aprovado|fa[cç]a|faz|manda|isso|claro|beleza|perfeito|certo|correto|exato|positivo|bora|vai|segue|prossiga").source}`,
  "u",
);
// Words that turn a yes into a different instruction.
const CONDITION = words("n[ãa]o|mas|s[óo]|somente|apenas|exceto|menos|por[ée]m|antes|depois|troc\\p{L}*|mud\\p{L}*|alter\\p{L}*|sem|outr[ao]s?");
const ASKED = /\?\s*$|confirm|posso (seguir|prosseguir|executar|fazer|criar|atribuir|alterar|atualizar)/i;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[“”"'.!,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The last message is a plain yes to a question the assistant asked just before it. */
export function plainApproval(turns: Turn[]): boolean {
  const last = turns[turns.length - 1];
  const before = turns[turns.length - 2];
  if (!last || last.role !== "user" || !before || before.role !== "assistant") return false;
  const reply = normalize(last.content);
  if (!reply || reply.length > 60 || !YES.test(reply) || CONDITION.test(reply)) return false;
  return ASKED.test(before.content.trim());
}
