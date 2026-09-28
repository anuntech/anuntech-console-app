import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { assistantConversations, assistantMessages } from "@/db/schema";

/** The first message names the conversation; enough to recognise it later. */
const titleFrom = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 72) || "Conversa";

export async function listConversations(userId: string) {
  const rows = await db
    .select({
      id: assistantConversations.id,
      title: assistantConversations.title,
      updatedAt: assistantConversations.updatedAt,
      messages: count(assistantMessages.id),
    })
    .from(assistantConversations)
    .leftJoin(assistantMessages, eq(assistantMessages.conversationId, assistantConversations.id))
    .where(eq(assistantConversations.userId, userId))
    .groupBy(assistantConversations.id)
    .orderBy(desc(assistantConversations.updatedAt))
    .limit(40);
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString(), messages: Number(r.messages) }));
}

export async function conversationMessages(userId: string, conversationId: string) {
  const [conversation] = await db
    .select({ id: assistantConversations.id, title: assistantConversations.title })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.userId, userId)));
  if (!conversation) return null;
  const messages = await db
    .select({ id: assistantMessages.id, role: assistantMessages.role, content: assistantMessages.content, steps: assistantMessages.steps })
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, conversationId))
    .orderBy(asc(assistantMessages.createdAt))
    .limit(200);
  return { ...conversation, messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, steps: m.steps ?? undefined })) };
}

/**
 * Stores one exchange. A conversation the person does not own (or that no
 * longer exists) starts a new one instead of failing the reply.
 */
export async function appendExchange(
  userId: string,
  conversationId: string | null,
  userText: string,
  reply: { reply: string; steps: string[] },
) {
  return db.transaction(async (tx) => {
    let id = conversationId;
    if (id) {
      const [owned] = await tx
        .select({ id: assistantConversations.id })
        .from(assistantConversations)
        .where(and(eq(assistantConversations.id, id), eq(assistantConversations.userId, userId)));
      if (!owned) id = null;
    }
    if (!id) {
      const [created] = await tx
        .insert(assistantConversations)
        .values({ userId, title: titleFrom(userText) })
        .returning({ id: assistantConversations.id });
      id = created.id;
    } else {
      await tx.update(assistantConversations).set({ updatedAt: new Date() }).where(eq(assistantConversations.id, id));
    }
    await tx.insert(assistantMessages).values([
      { conversationId: id, role: "user", content: userText },
      { conversationId: id, role: "assistant", content: reply.reply, steps: reply.steps.length ? reply.steps : null },
    ]);
    return id;
  });
}

export async function deleteConversation(userId: string, conversationId: string) {
  const deleted = await db
    .delete(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.userId, userId)))
    .returning({ id: assistantConversations.id });
  return deleted.length > 0;
}
