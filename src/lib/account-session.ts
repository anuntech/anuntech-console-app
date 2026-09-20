import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { allowedEmail } from "./otp-delivery";

export async function getAccountSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified || !(await allowedEmail(session.user.email)))
    return null;
  return session;
}

export async function requireRecentAccountSession() {
  const session = await getAccountSession();
  if (
    !session ||
    Date.now() - new Date(session.session.createdAt).getTime() > 600_000
  )
    throw new Error(
      "Entre novamente para alterar os dados de acesso da sua conta.",
    );
  return session;
}
