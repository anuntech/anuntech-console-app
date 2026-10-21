import "server-only";
import { ORPCError, os } from "@orpc/server";
import { actorForSession, canAccess, type Actor } from "../access/access";
import type { Area } from "../access/permissions";
import { auth } from "../auth/auth";

export type ApiContext = { headers: Headers };
type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type Guarded = { actor: Actor; session: Session };

/**
 * Who may call a procedure. Every procedure declares one (tests/api-access
 * fails otherwise), and it runs before the handler:
 * - `self`: anyone signed in, about their own account and devices;
 * - `staff`: the Anuntech team;
 * - `area` + `company`: the company the input points at (resolved on the
 *   server, from the record when the input names one), with that area.
 * Out of reach answers NOT_FOUND, like the web's notFound().
 */
export type Access<I> =
  | { self: true }
  | { staff: true }
  | {
      area: Area;
      company: (input: I) => string | null | undefined | Promise<string | null | undefined>;
    };

const guards = new WeakSet<object>();
/** Whether a middleware came from guard(), for the metatest. */
export const isGuard = (middleware: unknown) =>
  typeof middleware === "function" && guards.has(middleware);

export const missing = () =>
  new ORPCError("NOT_FOUND", { message: "Não encontrado." });

export function guard<I>(access: Access<I>) {
  const middleware = os
    .$context<ApiContext>()
    .middleware(async ({ context, next }, input: I) => {
      const session = await auth.api.getSession({ headers: context.headers });
      if (!session?.user.emailVerified)
        throw new ORPCError("UNAUTHORIZED", {
          message: "Entre novamente para continuar.",
        });
      // The app never acts in assisted access: the team uses the web for that.
      const actor = await actorForSession(session, { assisted: false });
      if ("staff" in access && !actor.admin) throw missing();
      if ("area" in access) {
        const companyId = await access.company(input);
        if (!companyId || !canAccess(actor, companyId, access.area))
          throw missing();
      }
      return next({ context: { actor, session } satisfies Guarded });
    });
  guards.add(middleware);
  return middleware;
}
