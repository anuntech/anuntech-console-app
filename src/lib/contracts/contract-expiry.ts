import "server-only";
import { and, asc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { auditEvents, companies, contracts } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { deliverContractExpiryNotice } from "./contract-mail";
import { addDays, contractTerm, EXPIRY_WARNING_DAYS } from "./contract-table";
import { staffEmails } from "../notifications/ops-alerts";

/**
 * One e-mail per signed contract when it enters the warning window, and
 * one more when the end date passes. Each is sent once; changing the end
 * date (directly or by amendment) re-arms both.
 */
export async function processContractExpiry(today = saoPauloDate()) {
  const url = process.env.BETTER_AUTH_URL || "http://localhost:3100";
  const [expiring, expired] = await Promise.all([
    db
      .select({ contract: contracts, company: companies.name })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(
        and(
          eq(contracts.status, "signed"),
          eq(contracts.kind, "contract"),
          isNull(contracts.expiryNoticeSentAt),
          gte(contracts.endsAt, today),
          lte(contracts.endsAt, addDays(today, EXPIRY_WARNING_DAYS)),
        ),
      )
      .orderBy(asc(contracts.endsAt))
      .limit(50),
    db
      .select({ contract: contracts, company: companies.name })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(
        and(
          eq(contracts.status, "signed"),
          eq(contracts.kind, "contract"),
          isNull(contracts.expiredNoticeSentAt),
          lt(contracts.endsAt, today),
        ),
      )
      .orderBy(asc(contracts.endsAt))
      .limit(50),
  ]);
  const recipients = expiring.length || expired.length ? await staffEmails() : [];
  const result = { expiring: 0, expired: 0, failed: 0 };
  for (const [stage, rows] of [
    ["expiring", expiring],
    ["expired", expired],
  ] as const) {
    for (const { contract, company } of rows) {
      const term = contractTerm({ startsAt: contract.startsAt, endsAt: contract.endsAt }, today);
      if (term.state !== "expiring" && term.state !== "expired") continue;
      let delivered = 0;
      for (const email of recipients) {
        try {
          await deliverContractExpiryNotice(email, {
            companyName: company,
            title: contract.title,
            url: `${url}/contratos/${contract.id}`,
            endsAt: contract.endsAt!,
            days: term.days,
            renewUrl: `${url}/contratos/novo?parentId=${contract.id}&prorrogar=1`,
          });
          delivered += 1;
        } catch {
          /* Tried again tomorrow while the flag stays unset. */
        }
      }
      if (!delivered && recipients.length) {
        result.failed += 1;
        continue;
      }
      await db
        .update(contracts)
        .set(stage === "expiring" ? { expiryNoticeSentAt: new Date() } : { expiredNoticeSentAt: new Date() })
        .where(eq(contracts.id, contract.id));
      await db.insert(auditEvents).values({
        actorId: contract.authorId,
        companyId: contract.companyId,
        entityId: contract.id,
        action: stage === "expiring" ? "contract.expiry_notice" : "contract.expired_notice",
        details: { endsAt: contract.endsAt, days: term.days, recipients: delivered },
      });
      result[stage] += 1;
    }
  }
  return result;
}
