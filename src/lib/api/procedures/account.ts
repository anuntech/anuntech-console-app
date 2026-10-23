import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard } from "../access";
import { allowedEmail } from "../../auth/otp-delivery";
import { deleteAccount, startAccountDeletion } from "../../account/account-deletion";
import { HandoffError, issueSessionHandoff } from "../../auth/session-handoff";

const refuse = (message: string) => new ORPCError("BAD_REQUEST", { message });

export const account = {
  requestDeletion: api.account.requestDeletion
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      // Same gate as the web's getAccountSession.
      if (!(await allowedEmail(context.session.user.email)))
        throw refuse("Entre novamente para excluir sua conta.");
      const result = await startAccountDeletion(context.session, input.channel);
      if ("error" in result) throw refuse(result.error);
      return result;
    }),
  delete: api.account.delete
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      if (!(await allowedEmail(context.session.user.email)))
        throw refuse("Entre novamente para excluir sua conta.");
      const result = await deleteAccount(context.session, input);
      if ("error" in result) throw refuse(result.error);
      return { deleted: true as const };
    }),
  openWeb: api.account.openWeb
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      // The app session is a full one (second step done, when on); the web gets its twin.
      try {
        return await issueSessionHandoff(
          { userId: context.session.user.id, sessionId: context.session.session.id },
          input.next,
        );
      } catch (error) {
        if (error instanceof HandoffError) throw refuse(error.message);
        throw error;
      }
    }),
};
