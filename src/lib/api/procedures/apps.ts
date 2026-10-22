import "server-only";
import { allowedIds, canAccess } from "../../access/access";
import { companyDisplayName } from "../../companies/display-name";
import { resolveAppOpening } from "../../apps/app-access";
import { openAppAs } from "../../apps/app-open";
import { appBlockText } from "../../apps/app-texts";
import { webUrl } from "../../products/product-opening";
import { api } from "../server";
import { guard, missing } from "../access";
import { refuse } from "../managed-company";
import { engagementCompany } from "./products";

export const apps = {
  /**
   * The web's /apps/[id] for the app: the same decision (resolveAppOpening)
   * and, when it opens, the same pass and audit (openAppAs). The app opens
   * the address in its browser instead of an iframe.
   */
  open: api.apps.open
    .use(guard({ area: "overview", company: engagementCompany }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const opening = await resolveAppOpening(actor, input.id);
      if (!opening.ok && opening.reason === "not_found") throw missing();
      if (!opening.ok) {
        // Services and projects have screens of their own.
        if (opening.reason === "not_product")
          return { kind: "page" as const, to: opening.engagement.kind === "project" ? ("project" as const) : ("service" as const), id: opening.engagement.id };
        // A client with one company is that company: "sua empresa", not its name.
        const company = actor.admin || new Set(allowedIds(actor, "overview")).size > 1 ? companyDisplayName(opening.company.name, opening.company.document) : undefined;
        const text = appBlockText(opening.reason, {
          app: opening.app?.name,
          product: opening.engagement.name,
          company,
          status: opening.engagement.status,
        });
        return {
          kind: "blocked" as const,
          product: opening.engagement.name,
          title: text.title,
          description: text.description,
          link: opening.reason === "not_protected" ? webUrl(opening.engagement.url) : null,
          ticket: opening.reason === "no_tenant",
          pay: opening.reason === "inactive" && opening.engagement.status === "suspended" && canAccess(actor, opening.company.id, "finance"),
        };
      }
      const result = await openAppAs(actor, opening.engagement.id);
      if ("error" in result) throw refuse(result.error);
      return { kind: "open" as const, url: result.src, app: opening.app.name };
    }),
};
