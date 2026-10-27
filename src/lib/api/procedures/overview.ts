import "server-only";
import { allowedIds } from "../../access/access";
import { companyDisplayName } from "../../companies/display-name";
import { engagementLabels } from "../../format";
import { protectedApps } from "../../apps/registry";
import { clientOverview } from "../../painel/client-overview";
import { thumbnailAddresses } from "../../drive/thumb-url";
import { listTickets } from "../../tickets/ticket-list";
import { api } from "../server";
import { guard } from "../access";
import { ticketRow } from "./tickets";
import { invoicePage, invoiceRow } from "./finance";
import { bankView } from "./hours";
import { productCard } from "./products";

const ticketsPage = (status: "waiting_customer" | "active") => ({
  status,
  search: "",
  company: "",
  page: 1,
  pageSize: 5,
});

export const overview = {
  // Built from the same lists as Chamados, Financeiro and the web's Painel (clientOverview), so the rules stay theirs.
  get: api.overview.get.use(guard({ self: true })).handler(async ({ context }) => {
    const { actor } = context;
    const canFinance = actor.admin || allowedIds(actor, "finance").length > 0;
    const [waiting, recent, overdue, open, painel] = await Promise.all([
      listTickets(actor, ticketsPage("waiting_customer")),
      listTickets(actor, ticketsPage("active")),
      canFinance ? invoicePage(actor, "overdue", 1, 5) : null,
      canFinance ? invoicePage(actor, "issued", 1, 5) : null,
      clientOverview(actor),
    ]);
    const toPay = [...(overdue?.list ?? []), ...(open?.list ?? [])]
      .map(invoiceRow)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
    const apps = protectedApps();
    const progress = new Map(painel.progress.map((p) => [p.engagementId, p]));
    const folderName = new Map(painel.folders.map((f) => [f.id, f.name]));
    const reviewProjects = [...new Set(painel.toReview.map((t) => t.projectId))];
    // The files' card pictures, as bookmarks.list gives them.
    const thumbs = await thumbnailAddresses(painel.bookmarkPage.items.filter((item) => item.thumb).map((item) => item.id));
    return {
      waiting: waiting.rows.map((row) => ticketRow(actor, row)),
      recent: recent.rows.map((row) => ticketRow(actor, row)),
      toPay,
      canFinance,
      canSupport: painel.canSupport,
      showCompany: actor.admin || actor.grants.length > 1,
      attention: {
        quotesToAnswer: painel.quotesToAnswer,
        contractsToSign: painel.contractsToSign,
        estimates: { count: painel.estimates.length, ticketId: painel.estimates.length === 1 ? painel.estimates[0].id : null },
        reviews: { count: painel.toReview.length, projectId: reviewProjects.length === 1 ? reviewProjects[0] : null },
        suspended: painel.suspended.map((p) => ({ id: p.id, name: p.name })),
      },
      projects: painel.projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        statusLabel: engagementLabels[p.status] ?? p.status,
        company: companyDisplayName(p.company, p.document),
        tasks: { total: progress.get(p.id)?.total ?? 0, done: progress.get(p.id)?.done ?? 0 },
      })),
      products: painel.products.map((p) => productCard(p, apps)),
      bookmarks: painel.bookmarkPage.items.map((item) => {
        // The same reading as bookmarks.list.
        const kind = item.board ? ("board" as const) : item.url ? ("link" as const) : ("file" as const);
        return {
          id: item.id,
          title: item.title,
          kind,
          url: kind === "link" ? item.url : null,
          fileName: item.fileName,
          filePath:
            kind === "file" ? `/api/bookmarks/${item.id}` : kind === "board" && item.preview ? `/api/bookmarks/${item.id}/preview` : null,
          folder: item.folderId ? (folderName.get(item.folderId) ?? null) : null,
          ...(thumbs.has(item.id) ? { thumbUrl: thumbs.get(item.id)! } : {}),
          fileSize: kind === "file" ? (item.fileSize ?? null) : null,
          updatedAt: item.updatedAt ?? item.createdAt,
        };
      }),
      nextCharge: painel.nextCharge
        ? { amountCents: painel.nextCharge.amountCents, dueDate: painel.nextCharge.dueDate, issueDate: painel.nextCharge.issueDate }
        : null,
      banks: painel.banks.map(bankView),
    };
  }),
};
