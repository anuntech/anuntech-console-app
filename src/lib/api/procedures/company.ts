import "server-only";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { companies } from "@/db/schema";
import { db } from "../../db";
import { updateCompanySettings } from "../../companies/company-settings";
import { CEP_LIMIT_MESSAGE, lookupRegistry, reserveCepLookup } from "../../companies/registry-lookup";
import { api } from "../server";
import { guard, missing } from "../access";
import { answer, managedCompany, refuse } from "../managed-company";

/** Configurações → Dados da empresa, for the company the person manages. */
export const company = {
  get: api.company.get.use(guard({ self: true })).handler(async ({ context }) => {
    const id = managedCompany(context.actor);
    const [row] = await db
      .select({
        name: companies.name,
        document: companies.document,
        billingEmail: companies.billingEmail,
        phone: companies.phone,
        address: companies.billingAddress,
      })
      .from(companies)
      .where(eq(companies.id, id));
    if (!row) throw missing();
    const a = row.address;
    return {
      id,
      name: row.name,
      document: row.document,
      billingEmail: row.billingEmail,
      phone: row.phone ?? "",
      address: a
        ? {
            cep: a.cep,
            endereco: a.endereco,
            numero: a.numero,
            complemento: a.complemento ?? "",
            bairro: a.bairro,
            cidade: a.cidade,
            uf: a.uf,
            codigoMunicipio: a.codigoMunicipio ?? "",
          }
        : null,
    };
  }),
  update: api.company.update.use(guard({ self: true })).handler(async ({ input, context }) => {
    const id = managedCompany(context.actor);
    return answer(await updateCompanySettings(context.actor, { id, ...input }));
  }),
  lookupCep: api.company.lookupCep.use(guard({ self: true })).handler(async ({ input, context }) => {
    managedCompany(context.actor);
    // The same hourly allowance as the web's lookup: both count on one key.
    if (!(await reserveCepLookup(context.actor.user.id)))
      throw new ORPCError("TOO_MANY_REQUESTS", { message: CEP_LIMIT_MESSAGE });
    const result = await lookupRegistry("cep", input.cep);
    if ("error" in result)
      throw result.status === 429
        ? new ORPCError("TOO_MANY_REQUESTS", { message: result.error })
        : result.status === 502
          ? new ORPCError("BAD_GATEWAY", { message: result.error })
          : refuse(result.error);
    const f = result.fields;
    return {
      endereco: f.endereco ?? "",
      bairro: f.bairro ?? "",
      cidade: f.cidade ?? "",
      uf: f.uf ?? "",
      codigoMunicipio: f.codigoMunicipio ?? "",
    };
  }),
};
