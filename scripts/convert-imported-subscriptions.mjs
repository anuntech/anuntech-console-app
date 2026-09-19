// One-time migration of the explicitly imported spreadsheet rows. Dry run by default.
// Reads current Console values; never emits charges, activates subscriptions or sends messages.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
const manifestPath = process.argv
  .find((a) => a.startsWith("--manifest="))
  ?.slice(11);
assert(manifestPath, "Informe --manifest=/caminho/result.json");
const rows = JSON.parse(readFileSync(manifestPath, "utf8")).filter(
  (r) => r.invoiceId && r.result !== "excluded_ended",
);
assert.equal(
  rows.length,
  27,
  "O manifesto deve conter as 27 assinaturas vigentes importadas",
);
assert.equal(new Set(rows.map((r) => r.invoiceId)).size, 27);
assert(rows.every((r) => ["Mensal", "Anual"].includes(r.interval)));
const apply = process.argv.includes("--apply");
const db = new pg.Client({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
await db.connect();
try {
  await db.query("BEGIN");
  const actor = (
    await db.query(
      "select id from console_user where lower(email)=lower($1) and email_verified=true",
      [process.env.CONSOLE_ADMIN_EMAIL],
    )
  ).rows[0];
  assert(actor, "Administrador verificado não encontrado");
  const summary = {
    apply,
    converted: 0,
    existing: 0,
    monthly: 0,
    yearly: 0,
    totalCents: 0,
  };
  for (const row of rows) {
    const i = (
      await db.query(
        "select *, due_date::text as due from console_invoices where id=$1 for update",
        [row.invoiceId],
      )
    ).rows[0];
    assert(
      i && i.company_id === row.companyId,
      "Fatura importada não corresponde ao manifesto",
    );
    assert(
      i.status === "draft" && !i.bank_request && !i.provider_id,
      "Fatura sofreu emissão; revisar antes de converter",
    );
    const interval = row.interval === "Mensal" ? "monthly" : "yearly";
    summary[interval]++;
    summary.totalCents += i.amount_cents;
    if (i.subscription_id) {
      const sub = (
        await db.query("select * from console_subscriptions where id=$1", [
          i.subscription_id,
        ])
      ).rows[0];
      assert(
        sub && sub.interval === interval && sub.company_id === i.company_id,
        "Recorrência divergente",
      );
      summary.existing++;
      continue;
    }
    const id = randomUUID();
    await db.query(
      "insert into console_subscriptions(id,company_id,engagement_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,lead_days,status,actor_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,5,'draft',$10)",
      [
        id,
        i.company_id,
        i.engagement_id,
        i.description,
        i.amount_cents,
        interval,
        Number(i.due.slice(8)),
        Number(i.due.slice(5, 7)),
        i.due,
        actor.id,
      ],
    );
    await db.query(
      "update console_invoices set subscription_id=$2 where id=$1",
      [i.id, id],
    );
    await db.query(
      "insert into console_audit_events(id,actor_id,company_id,action,entity_id,details) values($1,$2,$3,'subscription.imported',$4,$5)",
      [
        randomUUID(),
        actor.id,
        i.company_id,
        id,
        JSON.stringify({
          source: "Assinaturas.xlsx",
          invoiceId: i.id,
          row: row.row,
          interval,
          leadDays: 5,
        }),
      ],
    );
    summary.converted++;
  }
  await db.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(summary));
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
