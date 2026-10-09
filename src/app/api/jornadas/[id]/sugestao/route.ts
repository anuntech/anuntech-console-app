import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { journeySteps, journeys } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { MEETINGS, isExtraKey, templateStep } from "@/lib/journeys/journey-model";
import {
  draftDesignDirection,
  draftJourneyBriefing,
  draftJourneyPrompt,
  draftMeetingAgenda,
  draftStepHelp,
  suggestMissingSteps,
  triageFeedback,
} from "@/lib/journeys/journey-ai";

/*
 * The journey's AI drafts: briefing, project prompt, design direction,
 * meeting agendas, how to do a step, the client's feedback split and the
 * steps that may be missing. Into the screen only; the team reviews and
 * keeps what it wants. Staff only, per person and per kind an hour.
 * The content is never logged.
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

const suggestion = z.discriminatedUnion(
  "tipo",
  [
    z.object({
      tipo: z.literal("briefing"),
      notas: z
        .string({ error: "Escreva ou dite as notas da reunião antes." })
        .trim()
        .min(1, "Escreva ou dite as notas da reunião antes.")
        .max(16000, "As notas podem ter até 16 mil caracteres."),
      transcricao: z.string({ error: "A transcrição veio num formato inválido." }).trim().max(16000, "A transcrição pode ter até 16 mil caracteres.").optional(),
    }),
    z.object({ tipo: z.literal("prompt") }),
    z.object({
      tipo: z.literal("design"),
      referencias: z.string({ error: "As referências vieram num formato inválido." }).trim().max(2000, "As referências podem ter até 2 mil caracteres.").optional(),
    }),
    z.object({ tipo: z.literal("pauta"), reuniao: z.enum(MEETINGS, { error: "Escolha a reunião." }) }),
    z.object({ tipo: z.literal("passo"), passo: z.string({ error: "Escolha o passo." }).trim().min(1, "Escolha o passo.").max(80, "Passo desconhecido nesta jornada.") }),
    z.object({
      tipo: z.literal("retorno"),
      retorno: z
        .string({ error: "Cole o retorno do cliente antes." })
        .trim()
        .min(1, "Cole o retorno do cliente antes.")
        .max(8000, "O retorno pode ter até 8 mil caracteres."),
    }),
    z.object({ tipo: z.literal("lacunas") }),
  ],
  { error: "Tipo de sugestão desconhecido." },
);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond({ error: "O pedido foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  if (!actor.admin) return respond({ error: "Acesso negado." }, 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return respond({ error: "Jornada não encontrada." }, 404);
  const [journey] = await db.select({ id: journeys.id }).from(journeys).where(eq(journeys.id, id));
  if (!journey) return respond({ error: "Jornada não encontrada." }, 404);

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return respond({ error: "Pedido inválido." }, 400);
  const parsed = suggestion.safeParse(raw);
  if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? "Pedido inválido." }, 400);
  const body = parsed.data;
  if (body.tipo === "passo") {
    const known = isExtraKey(body.passo)
      ? !!(await db
          .select({ id: journeySteps.id })
          .from(journeySteps)
          .where(and(eq(journeySteps.journeyId, id), eq(journeySteps.key, body.passo)))
          .then((rows) => rows[0]))
      : !!templateStep(body.passo);
    if (!known) return respond({ error: "Passo desconhecido nesta jornada." }, 400);
  }

  if (!(await reserveHourly(`journey-${body.tipo}`, actor.user.id, body.tipo === "prompt" ? 10 : 20)))
    return respond({ error: "Muitas sugestões na última hora. Tente mais tarde." }, 429);
  const signal = request.signal;
  try {
    switch (body.tipo) {
      case "briefing":
        return respond({ briefing: await draftJourneyBriefing(id, { notas: body.notas, transcricao: body.transcricao }, signal) });
      case "prompt":
        return respond({ text: await draftJourneyPrompt(id, signal) });
      case "design":
        return respond({ design: await draftDesignDirection(id, { referencias: body.referencias }, signal) });
      case "pauta":
        return respond({ text: await draftMeetingAgenda(id, body.reuniao, signal) });
      case "passo":
        return respond({ text: await draftStepHelp(id, body.passo, signal) });
      case "retorno":
        return respond({ text: await triageFeedback(id, body.retorno, signal) });
      case "lacunas":
        return respond({ passos: await suggestMissingSteps(id, signal) });
    }
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Não foi possível sugerir agora." }, 502);
  }
}
