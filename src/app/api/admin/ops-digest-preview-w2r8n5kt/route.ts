import "server-only";
import { collectOpsDigest } from "@/lib/ops-alerts";
import { opsDigestText } from "@/lib/ops-digest-text";

/** Read-only: the text the morning digest would send right now, without sending. Remove after use. */
export async function GET() {
  const data = await collectOpsDigest();
  const { subject, text } = opsDigestText(data);
  return new Response(`${subject}\n\n${text}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
