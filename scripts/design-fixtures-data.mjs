// Dados fictícios do banco console_design (scripts/design-fixtures.mjs). Tudo aqui é inventado:
// empresas, pessoas, valores e textos existem só para as telas terem o que mostrar.
// E-mails usam o domínio reservado .invalid; IPs, a faixa de documentação 203.0.113.0/24.
import { createHash } from "node:crypto";

const DAY_MS = 24 * 3600 * 1000;
const J = (value) => JSON.stringify(value);
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const hashOf = (publication) => sha256(canonical(publication));

/**
 * The clock the fixtures count from: now during business hours (9h to 18h, São Paulo),
 * otherwise the last business moment, so a thread never reads "03:25" when the script
 * ran at night.
 */
const base = (() => {
  const now = Date.now();
  const spHour = new Date(now - 3 * 3600 * 1000).getUTCHours();
  if (spHour >= 9 && spHour < 18) return now;
  const sp = new Date(now - (spHour < 9 ? DAY_MS : 0) - 3 * 3600 * 1000).toISOString().slice(0, 10);
  return new Date(`${sp}T17:40:00-03:00`).getTime();
})();
/** A moment `days` from the base clock (negative: in the past), at `hour` São Paulo time when given. */
function at(days, hour) {
  const t = new Date(base + days * DAY_MS);
  if (hour === undefined) return t;
  const sp = new Date(t.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  return new Date(`${sp}T${String(hour).padStart(2, "0")}:00:00-03:00`);
}
/** São Paulo calendar date `days` from today, as YYYY-MM-DD. */
const d = (days) => new Date(Date.now() + days * DAY_MS - 3 * 3600 * 1000).toISOString().slice(0, 10);
const formatDocument = (doc) =>
  doc.length === 14
    ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
const year = Number(d(0).slice(0, 4));
const month = d(0).slice(0, 7);
const monthBefore = (() => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
})();

export async function seedData({ db, uid }) {
  const counts = {};
  async function ins(table, row) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    await db.query(
      `insert into ${table} (${keys.map((k) => `"${k}"`).join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      keys.map((k) => row[k]),
    );
    const short = table.replace(/^console_/, "");
    counts[short] = (counts[short] ?? 0) + 1;
  }
  const ids = {};

  /* ---------- people ---------- */

  const staffEmail = "equipe@design.invalid";
  const people = {
    kauan: { name: "Kauan Silva", email: staffEmail, image: "/brand/avatars/avatar-07.svg", phone: "+5547991230001" },
    marina: { name: "Marina Duarte", email: "marina@anuntech.invalid", image: "/brand/avatars/avatar-23.svg" },
    rafael: { name: "Rafael Lima", email: "rafael@anuntech.invalid", image: "/brand/avatars/avatar-41.svg" },
    renata: { name: "Renata Moura", email: "renata@vidaplena.invalid", image: "/brand/avatars/avatar-12.svg", phone: "+5511987650002" },
    paulo: { name: "Paulo Henrique Souza", email: "paulo@vidaplena.invalid", image: null },
    joao: { name: "João Batista Ferreira", email: "joao@bomgrao.invalid", image: "/brand/avatars/avatar-55.svg" },
    claudia: { name: "Cláudia Ramos", email: "financeiro@rotasul.invalid", image: null },
    marcos: { name: "Marcos Vinícius Andrade", email: "marcos.andrade@design.invalid", image: "/brand/avatars/avatar-33.svg" },
  };
  for (const [key, p] of Object.entries(people)) {
    p.id = uid(`user:${key}`);
    await ins("console_user", {
      id: p.id,
      name: p.name,
      email: p.email,
      email_verified: true,
      image: p.image,
      phone_number: p.phone ?? null,
      phone_number_verified: !!p.phone,
      created_at: at(key === "kauan" ? -400 : -120),
    });
  }
  const { kauan, marina, rafael, renata, paulo, joao, claudia, marcos } = people;
  for (const p of [marina, rafael])
    await ins("console_staff_members", { id: uid(`staff:${p.email}`), email: p.email, created_by: kauan.id, updated_by: kauan.id, created_at: at(-300) });

  const staffToken = uid("session:staff");
  const clientToken = uid("session:client");
  for (const [user, token] of [
    [kauan, staffToken],
    [renata, clientToken],
  ])
    await ins("console_session", {
      id: uid(`session-row:${user.email}`),
      token,
      user_id: user.id,
      expires_at: at(60),
      ip_address: "203.0.113.10",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
    });

  /* ---------- catalog ---------- */

  const catalog = {
    synova: {
      kind: "product",
      name: "Synova",
      description: "Sistema de gestão com agenda, cadastro de clientes e financeiro.",
      default_amount_cents: 49000,
      interval: "monthly",
      icon: "/brand/catalog-icons/synova.webp",
      suspension_kind: "app",
    },
    hospedagem: {
      kind: "product",
      name: "Hospedagem e e-mail",
      description: "Servidor do site, certificado e contas de e-mail no domínio da empresa.",
      default_amount_cents: 18900,
      interval: "monthly",
      icon: "/brand/catalog-icons/infra.webp",
      suspension_kind: "email",
    },
    dominio: {
      kind: "product",
      name: "Domínio .com.br",
      description: "Registro e renovação do domínio.",
      default_amount_cents: 4000,
      interval: "yearly",
      icon: "/brand/catalog-icons/dominio.webp",
      suspension_kind: "manual",
    },
    roteiro: {
      kind: "product",
      name: "Roteiro Digital",
      description: "App das rotas de entrega, aberto dentro do Console.",
      default_amount_cents: 35000,
      interval: "monthly",
      icon: "/brand/catalog-icons/app.webp",
      suspension_kind: "app",
    },
    suporte: {
      kind: "service",
      name: "Suporte e sustentação",
      description: "Correções, pequenas melhorias e atendimento por chamado, com banco de horas mensal.",
      default_amount_cents: 180000,
      interval: "monthly",
      icon: "/brand/catalog-icons/suporte.webp",
      what_we_do: "Corrigimos erros, aplicamos atualizações de segurança e fazemos melhorias pequenas pelo banco de horas.",
      what_we_need: "Chamados abertos no Console, com o passo a passo e prints quando houver erro.",
      expected_results: "Sistema estável e um relatório de horas no fim de cada mês.",
      deadlines: "Primeira resposta conforme a prioridade do chamado, em dias úteis.",
    },
    consultoria: {
      kind: "service",
      name: "Consultoria técnica",
      description: "Diagnóstico de sistemas, escolha de ferramentas e plano de migração.",
      default_amount_cents: 25000,
      interval: null,
      icon: "/brand/catalog-icons/consultoria.webp",
      what_we_do: "Levantamos como a empresa trabalha hoje e indicamos o que mudar, em ordem de prioridade.",
      what_we_need: "Duas reuniões de uma hora e acesso de leitura aos sistemas atuais.",
      expected_results: "Um documento com o diagnóstico e o plano, apresentado em reunião.",
      deadlines: "Entrega em até 10 dias úteis depois da segunda reunião.",
    },
    redes: {
      kind: "service",
      name: "Gestão de redes sociais",
      description: "Fora de oferta desde agosto.",
      default_amount_cents: 90000,
      interval: "monthly",
      icon: "/brand/catalog-icons/servico.webp",
      active: false,
    },
  };
  for (const [key, item] of Object.entries(catalog)) {
    item.id = uid(`catalog:${key}`);
    await ins("console_catalog_items", { active: true, ...item, id: item.id, created_at: at(-250), updated_at: at(-30) });
  }

  /* ---------- companies ---------- */

  const address = (endereco, numero, bairro, cidade, uf, cep, complemento = "") => J({ endereco, numero, complemento, bairro, cidade, uf, cep, codigoMunicipio: "" });
  const companies = {
    mei: {
      name: "46.301.732 ALINE DE SOUZA BEZERRA",
      document: "46301732000112",
      billing_email: "contato@alinebezerra.invalid",
      phone: "47991234567",
      billing_address: address("Rua XV de Novembro", "1820", "Centro", "Blumenau", "SC", "89010003", "Sala 4"),
      created_at: at(-12),
    },
    clinica: {
      name: "CLINICA VIDA PLENA LTDA",
      document: "28114567000190",
      billing_email: "financeiro@vidaplena.invalid",
      phone: "1133224455",
      billing_address: address("Avenida Paulista", "1578", "Bela Vista", "São Paulo", "SP", "01310200", "Conj. 82"),
      created_at: at(-160),
    },
    padaria: {
      name: "PADARIA BOM GRAO ME",
      document: "17333444000151",
      billing_email: "contato@bomgrao.invalid",
      phone: "4133557788",
      billing_address: address("Rua Mateus Leme", "455", "São Francisco", "Curitiba", "PR", "80510190"),
      created_at: at(-210),
    },
    rotasul: {
      name: "TRANSPORTES ROTA SUL LTDA",
      document: "09876543000110",
      billing_email: "financeiro@rotasul.invalid",
      phone: "5132104455",
      billing_address: address("Avenida Sertório", "6600", "Sarandi", "Porto Alegre", "RS", "91110580", "Galpão 3"),
      created_at: at(-330),
    },
    associacao: {
      name: "ASSOCIACAO DOS PRODUTORES RURAIS E AGRICULTORES FAMILIARES DO VALE DO RIBEIRA E LITORAL SUL",
      document: "35222111000187",
      billing_email: "secretaria@produtoresvaleribeira.invalid",
      phone: "1338211020",
      billing_address: address("Rua Major Rebouças", "210", "Centro", "Registro", "SP", "11900000"),
      created_at: at(-40),
    },
    escola: {
      name: "ESCOLA PEQUENO SABER LTDA",
      document: "44555666000102",
      billing_email: "secretaria@pequenosaber.invalid",
      phone: null,
      billing_address: null,
      created_at: at(-6),
    },
    oficina: {
      name: "OFICINA TORQUE AUTOMOTIVA LTDA",
      document: "11222333000181",
      billing_email: "oficina@torque.invalid",
      phone: "4832223344",
      billing_address: address("Rua Bocaiúva", "980", "Centro", "Florianópolis", "SC", "88015530"),
      archived: true,
      created_at: at(-520),
    },
    marcos: {
      name: "MARCOS VINICIUS ANDRADE",
      document: "39053344705",
      billing_email: "marcos.andrade@design.invalid",
      phone: "21998887766",
      billing_address: address("Rua Voluntários da Pátria", "45", "Botafogo", "Rio de Janeiro", "RJ", "22270000", "Apto 301"),
      created_at: at(-140),
    },
  };
  for (const [key, c] of Object.entries(companies)) {
    c.id = uid(`company:${key}`);
    await ins("console_companies", { archived: false, ...c, id: c.id });
  }
  const C = companies;
  ids.companies = Object.fromEntries(Object.entries(C).map(([k, c]) => [k, c.id]));

  /* ---------- memberships ---------- */

  const memberships = [
    ["clinica", renata.email, "manager", true, "all", -150],
    ["clinica", paulo.email, "member", true, "selected", -90],
    ["clinica", "recepcao@vidaplena.invalid", "member", true, "all", -3],
    ["mei", "aline@alinebezerra.invalid", "manager", true, "all", -10],
    ["padaria", joao.email, "manager", true, "all", -200],
    ["rotasul", claudia.email, "manager", true, "all", -320],
    ["rotasul", "operacao@rotasul.invalid", "member", true, "all", -100],
    ["associacao", "presidencia@produtoresvaleribeira.invalid", "manager", true, "all", -38],
    ["oficina", "oficina@torque.invalid", "manager", false, "all", -500],
    ["marcos", marcos.email, "manager", true, "all", -138],
  ];
  const membershipIds = {};
  for (const [company, email, role, active, access, created] of memberships) {
    const id = uid(`membership:${company}:${email}`);
    membershipIds[email] = id;
    await ins("console_memberships", { id, company_id: C[company].id, email, role, active, engagement_access: access, created_at: at(created) });
  }

  /* ---------- quotes ---------- */

  const phase = (name, description, hoursMin, hoursMax, weeks, tasks) => ({
    name,
    description,
    hoursMin,
    hoursMax,
    weeks,
    tasks: tasks.map(([title, description = ""]) => ({ title, description })),
  });
  const quoteDefs = {
    clinica: {
      seq: 4,
      company: "clinica",
      title: "Portal do paciente",
      status: "accepted",
      created: -75,
      sent: -70,
      decided: -66,
      validUntil: -40,
      content: {
        summary:
          "Objetivo: o paciente marca, remarca e cancela consultas sozinho e recebe o lembrete por WhatsApp.\n\nFuncionalidades:\n- Agenda por profissional e especialidade\n- Cadastro do paciente com convênio\n- Lembrete 24 horas antes\n- Painel da recepção",
        stack: ["Next.js", "PostgreSQL", "WhatsApp Business API"],
        phases: [
          phase("Descoberta e protótipo", "Fluxos da recepção e do paciente, protótipo navegável.", 16, 24, 2, [
            ["Mapear o atendimento atual da recepção"],
            ["Protótipo das telas do paciente"],
          ]),
          phase("Agenda e cadastro", "Agenda por profissional, cadastro e login do paciente.", 60, 80, 4, [
            ["Agenda por profissional", "Horários, bloqueios e feriados."],
            ["Cadastro e login do paciente", "Código por SMS."],
            ["Remarcar e cancelar"],
          ]),
          phase("Lembretes e painel", "Lembretes por WhatsApp e o painel da recepção.", 30, 40, 2, [
            ["Lembrete 24 horas antes"],
            ["Painel da recepção"],
          ]),
        ],
        hourlyRateCents: 15000,
        discountCents: 120000,
        upfrontPercent: 50,
        notes: "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.",
      },
      decision: { party: "client", by: renata, ip: "203.0.113.24" },
    },
    rotasul: {
      seq: 6,
      company: "rotasul",
      title: "Rastreamento de entregas",
      status: "declined",
      created: -50,
      sent: -48,
      decided: -35,
      validUntil: -18,
      content: {
        summary: "Objetivo: o cliente da transportadora acompanha a entrega pelo link enviado no WhatsApp.",
        stack: ["React Native", "Node.js"],
        phases: [
          phase("App do motorista", "Localização durante a rota e baixa da entrega com foto.", 80, 110, 5, [
            ["Login do motorista"],
            ["Rota do dia"],
            ["Baixa com foto e assinatura"],
          ]),
          phase("Link de acompanhamento", "Página pública com o mapa e a previsão.", 24, 32, 2, [["Página do pedido"], ["Aviso por WhatsApp"]]),
        ],
        hourlyRateCents: 14000,
        discountCents: 0,
        upfrontPercent: 40,
        notes: "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.",
      },
      decision: { party: "client", by: claudia, ip: "203.0.113.51", note: "Vamos retomar no próximo ano, depois da troca da frota." },
    },
    mei: {
      seq: 9,
      company: "mei",
      title: "Agenda online com lembretes",
      status: "accepted",
      created: -11,
      sent: -10,
      decided: -7,
      validUntil: 20,
      content: {
        summary:
          "Objetivo: as clientes do ateliê marcam prova e retirada de peças pela internet.\n\nFuncionalidades:\n- Agenda com horários de atendimento\n- Confirmação e lembrete por WhatsApp\n- Lista do dia para o ateliê",
        stack: ["Next.js", "PostgreSQL"],
        phases: [
          phase("Agenda", "Horários, bloqueios e a página de marcação.", 20, 28, 2, [
            ["Horários de atendimento"],
            ["Página de marcação"],
          ]),
          phase("Lembretes", "Confirmação e lembrete por WhatsApp.", 8, 12, 1, [["Confirmação ao marcar"], ["Lembrete no dia anterior"]]),
        ],
        hourlyRateCents: 12000,
        discountCents: 0,
        upfrontPercent: 50,
        notes: "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.",
      },
      decision: { party: "anuntech", by: kauan, note: "Aceite enviado pela Aline por WhatsApp em conversa com o Kauan." },
    },
    padaria: {
      seq: 10,
      company: "padaria",
      title: "Cardápio digital com pedidos",
      status: "sent",
      created: -9,
      sent: -4,
      validUntil: 26,
      content: {
        summary: "Objetivo: o cliente vê o cardápio pelo QR Code da mesa e faz o pedido, que chega impresso na cozinha.",
        stack: ["Next.js", "PostgreSQL"],
        phases: [
          phase("Cardápio", "Cadastro de produtos e a página pública.", 18, 24, 2, [["Cadastro de produtos e fotos"], ["Página do cardápio"]]),
          phase("Pedidos", "Carrinho, pedido pela mesa e impressão na cozinha.", 30, 42, 3, [
            ["Pedido pela mesa"],
            ["Impressão na cozinha"],
            ["Fechamento da conta"],
          ]),
        ],
        hourlyRateCents: 12000,
        discountCents: 30000,
        upfrontPercent: 50,
        notes: "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.",
      },
    },
    escola: {
      seq: 11,
      company: "escola",
      title: "App de recados para as famílias",
      status: "draft",
      created: -2,
      validUntil: 28,
      content: {
        summary: "Objetivo: a escola envia recados, autorizações e o cardápio da semana para as famílias.",
        stack: [],
        phases: [phase("Recados", "Envio por turma e confirmação de leitura.", 24, 32, 2, [["Recados por turma"], ["Confirmação de leitura"]])],
        hourlyRateCents: 0,
        discountCents: 0,
        upfrontPercent: 50,
        notes: "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.",
      },
    },
    associacao: {
      seq: 7,
      company: "associacao",
      title: "Site institucional",
      status: "cancelled",
      created: -38,
      validUntil: -8,
      content: {
        summary: "Site com notícias, associados e a agenda das feiras.",
        stack: ["Next.js"],
        phases: [phase("Site", "Páginas, notícias e agenda.", 30, 40, 3, [["Páginas institucionais"], ["Notícias"], ["Agenda das feiras"]])],
        hourlyRateCents: 11000,
        discountCents: 0,
        upfrontPercent: 50,
        notes: "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.",
      },
    },
  };
  const quotes = {};
  for (const [key, q] of Object.entries(quoteDefs)) {
    const id = uid(`quote:${key}`);
    const company = C[q.company];
    const number = `${year}-${String(q.seq).padStart(3, "0")}`;
    const validUntil = d(q.validUntil);
    const sent = q.status !== "draft" && q.sent !== undefined;
    const publication = sent
      ? { ...q.content, title: q.title, number, companyName: company.name, companyDocument: company.document, validUntil, version: 1 }
      : null;
    const hash = publication ? hashOf(publication) : null;
    const decided = q.decision && q.decided !== undefined;
    quotes[key] = { id, number, title: q.title, company: q.company, content: q.content };
    await ins("console_quotes", {
      id,
      company_id: company.id,
      year,
      seq: q.seq,
      title: q.title,
      content: J(q.content),
      valid_until: validUntil,
      revision: sent ? 2 : 1,
      status: q.status,
      publication: publication ? J(publication) : null,
      published_version: sent ? 1 : 0,
      published_at: sent ? at(q.sent, 10) : null,
      document_hash: hash,
      decided_at: decided ? at(q.decided, 15) : null,
      decided_by: decided ? q.decision.by.id : null,
      decided_party: decided ? q.decision.party : null,
      decided_name: decided ? q.decision.by.name : null,
      decided_email: decided ? q.decision.by.email : null,
      decided_ip: decided ? (q.decision.ip ?? null) : null,
      decision_note: decided ? (q.decision.note ?? null) : null,
      author_id: kauan.id,
      created_at: at(q.created, 9),
      updated_at: at(q.decided ?? q.sent ?? q.created, 16),
    });
    if (publication)
      await ins("console_quote_versions", { id: uid(`quote-version:${key}`), quote_id: id, version: 1, publication: J(publication), document_hash: hash, sent_by: kauan.id, created_at: at(q.sent, 10) });
  }
  ids.quotes = Object.fromEntries(Object.entries(quotes).map(([k, q]) => [k, q.id]));

  /* ---------- engagements and recurrences ---------- */

  const engagementDefs = {
    cli_portal: { company: "clinica", name: "Portal do paciente", kind: "project", status: "active", quote: "clinica", description: "Agenda online, cadastro do paciente e lembretes por WhatsApp.", created: -65 },
    cli_synova: { company: "clinica", name: "Synova", kind: "product", catalog: "synova", amount: 49000, url: "https://vidaplena.synova.invalid", created: -150 },
    cli_suporte: { company: "clinica", name: "Suporte e sustentação", kind: "service", catalog: "suporte", amount: 180000, created: -120 },
    mei_agenda: { company: "mei", name: "Agenda online com lembretes", kind: "project", status: "active", quote: "mei", description: "Marcação de provas e retiradas do ateliê.", created: -6 },
    pad_synova: { company: "padaria", name: "Synova", kind: "product", catalog: "synova", amount: 29000, url: "https://bomgrao.synova.invalid", created: -200 },
    pad_hosp: { company: "padaria", name: "Hospedagem e e-mail", kind: "product", catalog: "hospedagem", amount: 18900, created: -200 },
    rot_hosp: { company: "rotasul", name: "Hospedagem e e-mail", kind: "product", catalog: "hospedagem", amount: 18900, created: -320 },
    rot_roteiro: { company: "rotasul", name: "Roteiro Digital", kind: "product", catalog: "roteiro", amount: 35000, url: "https://brastemp-roteiro-digital.vercel.app/", created: -180 },
    rot_app: { company: "rotasul", name: "App de entregas", kind: "project", status: "completed", description: "App do motorista com a rota do dia.", created: -300 },
    ass_site: { company: "associacao", name: "Site institucional", kind: "project", status: "paused", description: "Aguardando os textos e as fotos da diretoria.", created: -35 },
    ofi_synova: { company: "oficina", name: "Synova", kind: "product", catalog: "synova", amount: 29000, status: "completed", created: -500 },
    mar_consultoria: { company: "marcos", name: "Consultoria técnica", kind: "service", catalog: "consultoria", amount: 150000, status: "completed", created: -130 },
  };
  const E = {};
  for (const [key, e] of Object.entries(engagementDefs)) {
    E[key] = { id: uid(`engagement:${key}`), company: e.company, name: e.name };
    await ins("console_engagements", {
      id: E[key].id,
      company_id: C[e.company].id,
      name: e.name,
      kind: e.kind,
      quote_id: e.quote ? quotes[e.quote].id : null,
      status: e.status ?? "active",
      description: e.description ?? (e.catalog ? catalog[e.catalog].description : null),
      url: e.url ?? null,
      catalog_item_id: e.catalog ? catalog[e.catalog].id : null,
      amount_cents: e.amount ?? null,
      created_at: at(e.created, 11),
    });
  }
  ids.engagements = Object.fromEntries(Object.entries(E).map(([k, e]) => [k, e.id]));
  await ins("console_membership_engagements", { membership_id: membershipIds[paulo.email], engagement_id: E.cli_portal.id, created_at: at(-90) });

  const nextOn = (anchor) => {
    const day = Math.min(anchor, 28);
    const today = d(0);
    const [y, m] = today.split("-").map(Number);
    const candidate = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (candidate > today) return candidate;
    return m === 12 ? `${y + 1}-01-${String(day).padStart(2, "0")}` : `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const subscriptionDefs = {
    cli_synova: { company: "clinica", engagement: "cli_synova", description: "Synova · mensalidade", amount: 49000, day: 10, status: "active" },
    cli_suporte: { company: "clinica", engagement: "cli_suporte", description: "Suporte e sustentação · mensalidade", amount: 180000, day: 30, status: "active" },
    pad_synova: { company: "padaria", engagement: "pad_synova", description: "Synova · mensalidade", amount: 29000, day: 5, status: "active" },
    pad_hosp: { company: "padaria", engagement: "pad_hosp", description: "Hospedagem e e-mail · mensalidade", amount: 18900, day: 5, status: "paused" },
    rot_hosp: { company: "rotasul", engagement: "rot_hosp", description: "Hospedagem e e-mail · mensalidade", amount: 18900, day: 20, status: "active" },
    ofi_synova: { company: "oficina", engagement: "ofi_synova", description: "Synova · mensalidade", amount: 29000, day: 15, status: "cancelled" },
  };
  const S = {};
  for (const [key, s] of Object.entries(subscriptionDefs)) {
    S[key] = uid(`subscription:${key}`);
    await ins("console_subscriptions", {
      id: S[key],
      company_id: C[s.company].id,
      engagement_id: E[s.engagement].id,
      description: s.description,
      amount_cents: s.amount,
      interval: "monthly",
      fine_bps: 200,
      interest_monthly_bps: 100,
      anchor_day: s.day,
      anchor_month: 1,
      next_due_date: nextOn(s.day),
      status: s.status,
      actor_id: kauan.id,
      created_at: at(-140),
    });
    await db.query("update console_engagements set subscription_id = $1 where id = $2", [S[key], E[s.engagement].id]);
  }

  /* ---------- invoices ---------- */

  const publicId = (key) => createHash("sha256").update(`public:${key}`).digest("base64url");
  const invoiceDefs = [
    ["cli_synova_ago", "clinica", "Synova · agosto", "paid", 49000, -73, { sub: "cli_synova", eng: "cli_synova", nfse: true }],
    ["cli_synova_set", "clinica", "Synova · setembro", "paid", 49000, -42, { sub: "cli_synova", eng: "cli_synova", nfse: true }],
    ["cli_synova_out", "clinica", "Synova · outubro", "issued", 49000, -12, { sub: "cli_synova", eng: "cli_synova" }],
    ["cli_suporte_set", "clinica", "Suporte e sustentação · setembro", "paid", 180000, -22, { sub: "cli_suporte", eng: "cli_suporte", nfse: true }],
    ["cli_suporte_out", "clinica", "Suporte e sustentação · outubro", "issued", 180000, 8, { sub: "cli_suporte", eng: "cli_suporte" }],
    ["cli_portal_entrada", "clinica", "Portal do paciente · entrada (50%)", "paid", 990000, -58, { eng: "cli_portal", quote: "clinica", nfse: true }],
    ["cli_portal_saldo", "clinica", "Portal do paciente · saldo (50%)", "draft", 990000, 30, { eng: "cli_portal", quote: "clinica" }],
    ["cli_duplicada", "clinica", "Synova · setembro (emitida em duplicidade)", "cancelled", 49000, -40, { eng: "cli_synova" }],
    ["mei_entrada", "mei", "Agenda online com lembretes · entrada (50%)", "issued", 240000, 3, { eng: "mei_agenda", quote: "mei" }],
    ["pad_synova_set", "padaria", "Synova · setembro", "paid", 29000, -47, { sub: "pad_synova", eng: "pad_synova", nfse: true }],
    ["pad_synova_out", "padaria", "Synova · outubro", "paid", 29000, -17, { sub: "pad_synova", eng: "pad_synova", nfse: "processing" }],
    ["pad_synova_nov", "padaria", "Synova · novembro", "draft", 29000, 14, { sub: "pad_synova", eng: "pad_synova" }],
    ["rot_hosp_ago", "rotasul", "Hospedagem e e-mail · agosto", "paid", 18900, -63, { sub: "rot_hosp", eng: "rot_hosp" }],
    ["rot_hosp_set", "rotasul", "Hospedagem e e-mail · setembro", "issued", 18900, -32, { sub: "rot_hosp", eng: "rot_hosp" }],
    ["rot_hosp_out", "rotasul", "Hospedagem e e-mail · outubro", "issued", 18900, -2, { sub: "rot_hosp", eng: "rot_hosp" }],
    ["rot_app_saldo", "rotasul", "App de entregas · saldo", "cancelled", 640000, -95, { eng: "rot_app", expired: true }],
    ["ass_entrada", "associacao", "Site institucional · entrada", "draft", 165000, 7, { eng: "ass_site" }],
    ["ofi_synova", "oficina", "Synova · março", "paid", 29000, -220, { sub: "ofi_synova", eng: "ofi_synova" }],
    ["mar_consultoria", "marcos", "Consultoria técnica · diagnóstico", "paid", 150000, -95, { eng: "mar_consultoria", nfse: "error" }],
  ];
  const I = {};
  for (const [key, company, description, status, cents, due, o] of invoiceDefs) {
    const id = uid(`invoice:${key}`);
    I[key] = id;
    const atBank = status === "issued" || status === "paid" || (status === "cancelled" && o.expired);
    const created = at(Math.min(due - 10, -1), 9);
    await ins("console_invoices", {
      id,
      company_id: C[company].id,
      engagement_id: o.eng ? E[o.eng].id : null,
      subscription_id: o.sub ? S[o.sub] : null,
      quote_id: o.quote ? quotes[o.quote].id : null,
      public_id: atBank ? publicId(key) : null,
      description,
      amount_cents: cents,
      due_date: d(due),
      fine_bps: 200,
      interest_monthly_bps: 100,
      status,
      provider_id: atBank ? uid(`provider:${key}`) : null,
      // Never this deployment's bank: the page does not try to sync fixtures with Inter.
      bank_base: atBank ? "fixture://design" : null,
      bank_status: status === "paid" ? "RECEBIDO" : status === "issued" ? "A_RECEBER" : o.expired ? "EXPIRADO" : null,
      bank_checked_at: atBank ? at(-0.01) : null,
      boleto_line: status === "issued" ? `07790001160${createHash("sha256").update(`boleto:${key}`).digest("hex").replace(/[a-f]/g, (c) => String(c.charCodeAt(0) % 10)).slice(0, 26)}${String(cents).padStart(10, "0")}`.slice(0, 47) : null,
      pix_copy_paste: status === "issued" ? `00020101021226930014br.gov.bcb.pix2571spi-h.inter.co/pix/v2/cobv/${uid(`pix:${key}`).replace(/-/g, "")}5204000053039865802BR5925ANUNTECH6009SAO PAULO62070503***6304ABCD` : null,
      fiscal_status: o.nfse === true ? "authorized" : o.nfse || "not_requested",
      fiscal_url: o.nfse === true ? `https://nfse.design.invalid/notas/${key}` : null,
      created_at: created,
    });
  }
  ids.invoices = I;
  ids.publicInvoices = { issued: publicId("cli_synova_out"), paid: publicId("cli_synova_set"), expired: publicId("rot_app_saldo"), mei: publicId("mei_entrada") };

  // What the Console sent about each issued charge, for Financeiro > Envios.
  const notices = [
    ["cli_synova_out", "email", "initial", "delivered", renata.email, -22],
    ["cli_synova_out", "whatsapp", "initial", "delivered", "5511987650002", -22],
    ["cli_synova_out", "email", "overdue_10", "accepted", renata.email, -2],
    ["cli_suporte_out", "email", "initial", "delivered", "financeiro@vidaplena.invalid", -2],
    ["mei_entrada", "email", "initial", "failed", "aline@alinebezerra.invalid", -7],
    ["mei_entrada", "whatsapp", "initial", "delivered", "5547991234567", -7],
    ["rot_hosp_set", "email", "overdue_25", "delivered", claudia.email, -7],
    ["rot_hosp_set", "whatsapp", "overdue_25", "uncertain", "5551321044550", -7],
    ["rot_hosp_out", "email", "initial", "delivered", claudia.email, -12],
  ];
  for (const [inv, channel, kind, status, recipient, when] of notices)
    await ins("console_billing_notices", {
      id: uid(`notice:${inv}:${channel}:${kind}`),
      invoice_id: I[inv],
      actor_id: kauan.id,
      channel,
      recipient,
      kind,
      status,
      provider_id: status === "failed" ? null : uid(`notice-provider:${inv}:${channel}:${kind}`),
      error: status === "failed" ? "Caixa de entrada não existe (550 5.1.1)." : null,
      attempts: 1,
      first_attempt_at: at(when, 9),
      next_attempt_at: at(when, 9),
      created_at: at(when, 9),
    });

  /* ---------- contracts ---------- */

  const templates = {
    projeto: {
      name: "Desenvolvimento de projeto",
      description: "Projeto sob medida, com entrada e saldo.",
      body: `CONTRATO DE DESENVOLVIMENTO DE SOFTWARE\n\nCONTRATANTE: {{empresa}}, inscrita sob o nº {{cnpj}}, com endereço em {{endereco}}.\nCONTRATADA: {{anuntech}}, inscrita sob o nº {{anuntech_cnpj}}.\n\nCLÁUSULA 1 — OBJETO\n1.1 A CONTRATADA desenvolverá {{produto}}, conforme o escopo da proposta aceita.\n1.2 Mudanças de escopo serão tratadas por aditivo.\n\nCLÁUSULA 2 — VALOR E PAGAMENTO\n2.1 O valor total é de {{valor}}, pago em entrada e saldo.\n2.2 Atrasos têm multa de 2% e juros de 1% ao mês.\n\nCLÁUSULA 3 — VIGÊNCIA\n3.1 Este contrato vigora de {{inicio}} a {{fim}}.\n\n{{data}}`,
    },
    suporte: {
      name: "Suporte e sustentação",
      description: "Banco de horas mensal e prazos de atendimento por prioridade.",
      body: `CONTRATO DE SUPORTE E SUSTENTAÇÃO\n\nCONTRATANTE: {{empresa}}, inscrita sob o nº {{cnpj}}.\nCONTRATADA: {{anuntech}}, inscrita sob o nº {{anuntech_cnpj}}.\n\nCLÁUSULA 1 — OBJETO\n1.1 Suporte e sustentação de {{produto}}, por chamado aberto no Console.\n\nCLÁUSULA 2 — VALOR\n2.1 Mensalidade de {{valor}}, cobrada em ciclo {{ciclo}}.\n\nCLÁUSULA 3 — VIGÊNCIA\n3.1 De {{inicio}} a {{fim}}.\n\n{{data}}`,
    },
    synova: {
      name: "Licença de uso do Synova",
      description: "Licença mensal do sistema, sem desenvolvimento.",
      body: `CONTRATO DE LICENÇA DE USO\n\nCONTRATANTE: {{empresa}}, inscrita sob o nº {{cnpj}}.\nCONTRATADA: {{anuntech}}.\n\nCLÁUSULA 1 — OBJETO\n1.1 Licença de uso do Synova, acessado pela internet.\n\nCLÁUSULA 2 — VALOR\n2.1 Mensalidade de {{valor}}.\n\n{{data}}`,
    },
    hospedagem: {
      name: "Hospedagem e e-mail",
      description: "Servidor, certificado e contas de e-mail.",
      body: `CONTRATO DE HOSPEDAGEM\n\nCONTRATANTE: {{empresa}}.\nCONTRATADA: {{anuntech}}.\n\nCLÁUSULA 1 — OBJETO\n1.1 Hospedagem do site e contas de e-mail.\n\n{{data}}`,
      active: false,
    },
  };
  for (const [key, t] of Object.entries(templates)) {
    t.id = uid(`template:${key}`);
    await ins("console_contract_templates", { id: t.id, name: t.name, description: t.description, body: t.body, active: t.active ?? true, created_at: at(-260), updated_at: at(-20) });
  }

  const contractBody = (title, company, lines) =>
    [
      title.toUpperCase(),
      `CONTRATANTE: ${company.name}, inscrita sob o nº ${formatDocument(company.document)}.\nCONTRATADA: ANUNTECH, prestadora dos serviços descritos abaixo.`,
      ...lines,
    ].join("\n\n");
  const contractDefs = {
    cli_portal: {
      company: "clinica",
      engagement: "cli_portal",
      quote: "clinica",
      template: "projeto",
      title: "Contrato de desenvolvimento · Portal do paciente",
      status: "signed",
      sent: -64,
      signed: -62,
      starts: -62,
      ends: 120,
      lines: [
        `CLÁUSULA 1 — OBJETO\n1.1 A CONTRATADA desenvolverá o Portal do paciente, conforme a proposta ${year}-004.\n1.2 Mudanças de escopo serão tratadas por aditivo.`,
        "CLÁUSULA 2 — VALOR E PAGAMENTO\n2.1 O valor total é de R$ 19.800,00, pago em entrada de 50% e saldo na entrega.\n2.2 Atrasos têm multa de 2% e juros de 1% ao mês.",
        "CLÁUSULA 3 — VIGÊNCIA\n3.1 Este contrato vigora até a entrega e o aceite do projeto.",
      ],
    },
    cli_suporte: {
      company: "clinica",
      engagement: "cli_suporte",
      template: "suporte",
      title: "Contrato de suporte e sustentação",
      status: "signed",
      sent: -125,
      signed: -121,
      starts: -120,
      ends: 18,
      lines: [
        "CLÁUSULA 1 — OBJETO\n1.1 Suporte e sustentação do Synova e do Portal do paciente, por chamado aberto no Console.",
        "CLÁUSULA 2 — BANCO DE HORAS\n2.1 O banco de horas é de 20 horas por mês.\n2.2 Horas além do banco dependem de aprovação do Administrador.",
        "CLÁUSULA 3 — VALOR\n3.1 Mensalidade de R$ 1.800,00.",
      ],
    },
    cli_aditivo: {
      company: "clinica",
      engagement: "cli_portal",
      template: "projeto",
      kind: "amendment",
      parent: "cli_portal",
      title: "Aditivo · teleconsulta no Portal do paciente",
      status: "draft",
      starts: 5,
      lines: ["CLÁUSULA 1 — OBJETO DO ADITIVO\n1.1 Inclui a teleconsulta por vídeo no escopo do Portal do paciente.\n1.2 Valor adicional de {{valor}}."],
    },
    mei_agenda: {
      company: "mei",
      engagement: "mei_agenda",
      quote: "mei",
      template: "projeto",
      title: "Contrato de desenvolvimento · Agenda online",
      status: "sent",
      sent: -5,
      starts: -5,
      ends: 55,
      lines: [
        `CLÁUSULA 1 — OBJETO\n1.1 A CONTRATADA desenvolverá a Agenda online com lembretes, conforme a proposta ${year}-009.`,
        "CLÁUSULA 2 — VALOR E PAGAMENTO\n2.1 O valor total é de R$ 4.800,00, pago em entrada de 50% e saldo na entrega.",
      ],
    },
    pad_synova: {
      company: "padaria",
      engagement: "pad_synova",
      template: "synova",
      title: "Licença de uso do Synova",
      status: "draft",
      lines: ["CLÁUSULA 1 — OBJETO\n1.1 Licença de uso do Synova, acessado pela internet.", "CLÁUSULA 2 — VALOR\n2.1 Mensalidade de R$ 290,00."],
    },
    rot_hosp: {
      company: "rotasul",
      engagement: "rot_hosp",
      template: "hospedagem",
      title: "Contrato de hospedagem e e-mail",
      status: "in_review",
      sent: -9,
      starts: -9,
      ends: 356,
      lines: [
        "CLÁUSULA 1 — OBJETO\n1.1 Hospedagem do site e até 15 contas de e-mail.",
        "CLÁUSULA 2 — SUSPENSÃO\n2.1 Após 15 dias de atraso, o serviço pode ser suspenso com aviso prévio.",
        "CLÁUSULA 3 — VALOR\n3.1 Mensalidade de R$ 189,00.",
      ],
    },
    ofi_synova: {
      company: "oficina",
      engagement: "ofi_synova",
      template: "synova",
      title: "Licença de uso do Synova",
      status: "cancelled",
      lines: ["CLÁUSULA 1 — OBJETO\n1.1 Licença de uso do Synova."],
    },
  };
  const K = {};
  for (const [key, c] of Object.entries(contractDefs)) {
    const id = uid(`contract:${key}`);
    K[key] = { id, ...c };
    const company = C[c.company];
    const body = contractBody(c.title, company, c.lines);
    const sent = c.sent !== undefined;
    const parent = c.parent ? K[c.parent] : null;
    const publication = sent
      ? {
          title: c.title,
          body,
          companyName: company.name,
          companyDocument: company.document,
          kind: c.kind ?? "contract",
          parentTitle: parent?.title ?? null,
          parentHash: parent?.hash ?? null,
          startsAt: c.starts !== undefined ? d(c.starts) : null,
          endsAt: c.ends !== undefined ? d(c.ends) : null,
          version: 1,
        }
      : null;
    const hash = publication ? hashOf(publication) : null;
    K[key].hash = hash;
    await ins("console_contracts", {
      id,
      company_id: company.id,
      template_id: templates[c.template].id,
      engagement_id: c.engagement ? E[c.engagement].id : null,
      quote_id: c.quote ? quotes[c.quote].id : null,
      kind: c.kind ?? "contract",
      parent_id: parent?.id ?? null,
      title: c.title,
      body,
      revision: sent ? 2 : 1,
      starts_at: c.starts !== undefined ? d(c.starts) : null,
      ends_at: c.ends !== undefined ? d(c.ends) : null,
      status: c.status,
      publication: publication ? J(publication) : null,
      published_version: sent ? 1 : 0,
      published_at: sent ? at(c.sent, 10) : null,
      document_hash: hash,
      signed_at: c.signed !== undefined ? at(c.signed, 17) : null,
      author_id: kauan.id,
      created_at: at((c.sent ?? -3) - 2, 9),
      updated_at: at(c.signed ?? c.sent ?? -1, 17),
    });
    if (publication)
      await ins("console_contract_versions", { id: uid(`contract-version:${key}`), contract_id: id, version: 1, title: c.title, body, document_hash: hash, sent_by: kauan.id, created_at: at(c.sent, 10) });
    if (c.signed !== undefined) {
      const signer = c.company === "clinica" ? renata : claudia;
      for (const [party, who, offset, ip] of [
        ["anuntech", kauan, c.sent + 0.5, "203.0.113.10"],
        ["client", signer, c.signed, "203.0.113.24"],
      ])
        await ins("console_contract_signatures", {
          id: uid(`signature:${key}:${party}`),
          contract_id: id,
          party,
          user_id: who.id,
          name: who.name,
          email: who.email,
          document_hash: hash,
          ip,
          user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
          method: "otp_session",
          session_started_at: at(offset - 0.02),
          created_at: at(offset),
        });
    }
  }
  // The MEI contract: the team signed, the client still has to.
  await ins("console_contract_signatures", {
    id: uid("signature:mei_agenda:anuntech"),
    contract_id: K.mei_agenda.id,
    party: "anuntech",
    user_id: kauan.id,
    name: kauan.name,
    email: kauan.email,
    document_hash: K.mei_agenda.hash,
    ip: "203.0.113.10",
    method: "otp_session",
    session_started_at: at(-4.9),
    created_at: at(-4.88),
  });
  const changeRequests = [
    [1, "Cláusula 1.1", "1.1 Hospedagem do site e até 15 contas de e-mail.", "Hoje usamos 18 contas. Precisamos de pelo menos 20.", "1.1 Hospedagem do site e até 20 contas de e-mail."],
    [3, "Cláusula 2.1", "2.1 Após 15 dias de atraso, o serviço pode ser suspenso com aviso prévio.", "Pedimos que o aviso venha com pelo menos 5 dias úteis de antecedência.", null],
  ];
  for (const [blockIndex, label, excerpt, comment, proposed] of changeRequests)
    await ins("console_contract_change_requests", {
      id: uid(`change:${label}`),
      contract_id: K.rot_hosp.id,
      version: 1,
      block_index: blockIndex,
      label,
      excerpt,
      comment,
      proposed_text: proposed,
      status: "pending",
      author_id: claudia.id,
      created_at: at(-3, 10),
      submitted_at: at(-3, 11),
    });
  ids.contracts = Object.fromEntries(Object.entries(K).map(([k, c]) => [k, c.id]));

  /* ---------- service terms, hours bank ---------- */

  const { termsPresets } = await import("../src/lib/service-terms/presets.ts");
  const preset = (key) => structuredClone(termsPresets.find((p) => p.key === key).policy);
  const supportPolicy = preset("support");
  supportPolicy.hoursBank = { monthlyMinutes: 1200, alertPercent: 80, overageCents: 15000, reportContestDays: 5 };
  const termsDefs = {
    clinica: { company: "clinica", engagement: null, basis: "console_contract", preset: "support", label: "Suporte e sustentação", contract: "cli_suporte", policy: supportPolicy, publish: -110 },
    padaria: { company: "padaria", engagement: "pad_synova", basis: "external_contract", preset: "synova", label: "Licença Synova", policy: preset("synova"), publish: -150 },
    rotasul: { company: "rotasul", engagement: "rot_hosp", basis: "external_contract", preset: "infra", label: "Hospedagem e e-mail", policy: preset("infra"), publish: null },
  };
  const T = {};
  for (const [key, t] of Object.entries(termsDefs)) {
    T[key] = { id: uid(`terms:${key}`), ...t };
    await ins("console_service_terms", {
      id: T[key].id,
      company_id: C[t.company].id,
      engagement_id: t.engagement ? E[t.engagement].id : null,
      basis: t.basis,
      preset: t.preset,
      label: t.label,
      contract_id: t.contract ? K[t.contract].id : null,
      policy: J(t.policy),
      publish_at: t.publish !== null ? at(t.publish) : null,
      verified_by: t.publish !== null ? kauan.id : null,
      verified_at: t.publish !== null ? at(t.publish) : null,
      created_at: at(-160),
      updated_at: at(t.publish ?? -5),
    });
  }
  const snapshot = (key) =>
    T[key]
      ? J({ termsId: T[key].id, version: 1, label: T[key].label, preset: T[key].preset, policy: T[key].policy, publishAt: T[key].publish !== null ? at(T[key].publish).toISOString() : null, personClient: false })
      : null;

  /* ---------- tickets and threads ---------- */

  const ticketDefs = {
    cli_sms: {
      company: "clinica",
      engagement: "cli_portal",
      subject: "Paciente não recebe o código de acesso por SMS",
      status: "open",
      priority: "critical",
      kind: "problem",
      impact: "down",
      author: renata,
      created: -0.08,
      thread: [[renata, 0, "Desde as 8h nenhum paciente consegue entrar no portal. O código por SMS não chega, nem para números de operadoras diferentes. A recepção está marcando por telefone."]],
    },
    cli_convenio: {
      company: "clinica",
      engagement: "cli_portal",
      subject: "Incluir o campo de convênio no cadastro do paciente",
      status: "in_progress",
      priority: "normal",
      kind: "change",
      author: renata,
      created: -6,
      estimate: [360, "approved"],
      thread: [
        [renata, 0, "Precisamos guardar o convênio e o número da carteirinha no cadastro. A recepção pede isso em toda consulta."],
        [marina, 0.2, "Dá para incluir os dois campos e mostrar o convênio no painel da recepção. Estimamos 6 horas do banco. Pode aprovar a estimativa no chamado?"],
        [renata, 1, "Aprovado. A carteirinha pode ficar opcional."],
        [marina, 3, "Combinado. Os campos já estão no ambiente de teste; a entrega fica para esta semana."],
      ],
    },
    cli_relatorio: {
      company: "clinica",
      engagement: "cli_portal",
      subject: "Relatório de agendamentos por profissional",
      status: "waiting_customer",
      priority: "normal",
      kind: "question",
      author: paulo,
      created: -5,
      waiting: ["O modelo de relatório que a recepção usa hoje", -2],
      thread: [
        [paulo, 0, "Conseguimos tirar um relatório com quantas consultas cada profissional teve no mês?"],
        [rafael, 1, "Conseguimos. Para montar igual ao que vocês já usam, pode mandar o modelo atual da recepção (planilha ou foto)?"],
      ],
    },
    cli_acesso: {
      company: "clinica",
      subject: "Acesso para a nova recepcionista",
      status: "resolved",
      priority: "normal",
      kind: "access",
      author: renata,
      created: -9,
      thread: [
        [renata, 0, "A Juliana começou na recepção. Ela precisa ver a agenda e os chamados."],
        [marina, 0.1, "Convite enviado para recepcao@vidaplena.invalid como Membro. Assim que ela entrar, já vê a agenda."],
      ],
    },
    cli_exportar: {
      company: "clinica",
      engagement: "cli_synova",
      subject: "Exportar a agenda do mês em planilha",
      status: "closed",
      priority: "normal",
      kind: "question",
      author: renata,
      created: -24,
      thread: [
        [renata, 0, "Como exporto a agenda de setembro?"],
        [rafael, 0.3, "Em Agenda, abra Relatórios e escolha Exportar. O arquivo sai em planilha com uma linha por consulta."],
        [renata, 0.5, "Deu certo, obrigada."],
      ],
    },
    mei_boleto: {
      company: "mei",
      subject: "Pagar a entrada por Pix",
      status: "open",
      priority: "normal",
      kind: "question",
      channel: "whatsapp",
      author: kauan,
      created: -0.6,
      thread: [[kauan, 0, "A Aline perguntou pelo WhatsApp se pode pagar a entrada por Pix em vez de boleto. Registrado aqui para responder pelo Console."]],
    },
    pad_cardapio: {
      company: "padaria",
      subject: "Cardápio digital: novo projeto",
      status: "in_progress",
      priority: "normal",
      kind: "new_project",
      author: joao,
      created: -15,
      thread: [
        [joao, 0, "Queremos que o cliente faça o pedido pela mesa, com QR Code, e que o pedido saia impresso na cozinha."],
        [kauan, 1, "Marcamos a conversa para quinta às 15h. Depois dela, mandamos o orçamento por aqui."],
        [kauan, 11, `Orçamento ${year}-010 enviado. Ele fica disponível em Orçamentos para aceitar ou pedir ajustes.`],
      ],
    },
    pad_impressora: {
      company: "padaria",
      engagement: "pad_synova",
      subject: "Impressora da cozinha não imprime os pedidos",
      status: "resolved",
      priority: "high",
      kind: "problem",
      impact: "workaround",
      author: joao,
      created: -4,
      thread: [
        [joao, 0, "Os pedidos aparecem na tela, mas a impressora da cozinha parou. Estamos anotando à mão."],
        [rafael, 0.1, "A impressora perdeu a conexão depois da troca do roteador. Pode conferir se ela está na rede Bomgrao-Cozinha?"],
        [joao, 0.2, "Estava na rede errada. Voltou a imprimir."],
      ],
    },
    rot_boleto: {
      company: "rotasul",
      subject: "Boleto de setembro não chegou",
      status: "waiting_customer",
      priority: "normal",
      kind: "question",
      author: claudia,
      created: -6,
      waiting: ["Confirmar o e-mail do financeiro para receber os boletos", -5],
      thread: [
        [claudia, 0, "Não recebemos o boleto da hospedagem de setembro."],
        [marina, 1, "O boleto foi enviado para financeiro@rotasul.invalid em 20/09 e também está em Financeiro. Esse e-mail continua certo para os próximos?"],
      ],
    },
    rot_email: {
      company: "rotasul",
      engagement: "rot_hosp",
      subject: "E-mails do financeiro voltando",
      status: "in_progress",
      priority: "high",
      kind: "problem",
      impact: "workaround",
      author: claudia,
      created: -1,
      thread: [
        [claudia, 0, "Desde ontem, mensagens enviadas para financeiro@ voltam com erro de caixa cheia."],
        [rafael, 0.05, "A caixa chegou ao limite de 5 GB. Liberamos espaço temporário e estamos arquivando as mensagens antigas."],
      ],
    },
    ass_foto: {
      company: "associacao",
      engagement: "ass_site",
      subject: "Atualizar a foto da diretoria no site",
      status: "open",
      priority: "normal",
      kind: "change",
      channel: "email",
      author: kauan,
      created: -2,
      thread: [[kauan, 0, "A secretaria mandou por e-mail a foto da nova diretoria para a página Quem somos."]],
    },
    ofi_antigo: {
      company: "oficina",
      engagement: "ofi_synova",
      subject: "Cancelar a licença do Synova",
      status: "closed",
      priority: "normal",
      kind: "access",
      author: kauan,
      created: -210,
      thread: [[kauan, 0, "Pedido de cancelamento recebido por telefone. Licença encerrada no fim do mês."]],
    },
  };
  const TK = {};
  const staffIds = new Set([kauan.id, marina.id, rafael.id]);
  for (const [key, t] of Object.entries(ticketDefs)) {
    const id = uid(`ticket:${key}`);
    TK[key] = id;
    const created = at(t.created);
    const firstStaff = t.thread.find(([who], i) => i > 0 && staffIds.has(who.id));
    const lastAt = at(t.created + t.thread.at(-1)[1]);
    const terms = snapshot(t.company);
    await ins("console_tickets", {
      id,
      company_id: C[t.company].id,
      engagement_id: t.engagement ? E[t.engagement].id : null,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      author_id: t.author.id,
      assigned_to: (firstStaff?.[0] ?? kauan).email,
      kind: t.kind,
      impact: t.impact ?? null,
      channel: t.channel ?? "console",
      waiting_for: t.waiting?.[0] ?? null,
      waiting_since: t.waiting ? at(t.waiting[1]) : null,
      first_response_at: firstStaff ? at(t.created + firstStaff[1]) : null,
      response_due_at: terms ? new Date(created.getTime() + (t.priority === "critical" ? 4 : t.priority === "high" ? 9 : 18) * 3600 * 1000) : null,
      resolution_due_at: terms ? new Date(created.getTime() + (t.priority === "critical" ? 9 : t.priority === "high" ? 27 : 90) * 3600 * 1000) : null,
      terms,
      estimate_minutes: t.estimate?.[0] ?? null,
      estimate_status: t.estimate?.[1] ?? null,
      estimate_decided_by: t.estimate ? renata.id : null,
      estimate_decided_at: t.estimate ? at(t.created + 1) : null,
      created_at: created,
      updated_at: lastAt,
    });
    for (const [i, [who, offset, body]] of t.thread.entries())
      await ins("console_messages", { id: uid(`message:${key}:${i}`), ticket_id: id, author_id: who.id, body, created_at: at(t.created + offset) });
  }
  ids.tickets = TK;
  await db.query("update console_quotes set ticket_id = $1 where id = $2", [TK.pad_cardapio, quotes.padaria.id]);

  const timeEntries = [
    [TK.cli_convenio, null, 150, "Campos de convênio e carteirinha no cadastro", 0, "bank"],
    [TK.cli_convenio, null, 120, "Convênio no painel da recepção", 1, "bank"],
    [TK.cli_exportar, null, 30, "Orientação sobre a exportação", 2, "bank"],
    [null, E.cli_suporte.id, 240, "Atualização de segurança do servidor", 3, "bank"],
    [null, E.cli_suporte.id, 180, "Ajuste no envio dos lembretes", 4, "bank"],
    [TK.cli_sms, null, 45, "Diagnóstico do envio de SMS", 0, "critical"],
    [null, E.cli_suporte.id, 90, "Correção do horário de verão na agenda", 5, "warranty"],
  ];
  for (const [i, [ticket, engagement, minutes, note, back, kind]] of timeEntries.entries())
    await ins("console_time_entries", {
      id: uid(`time:${i}`),
      company_id: C.clinica.id,
      ticket_id: ticket,
      engagement_id: engagement,
      author_id: i % 2 ? rafael.id : marina.id,
      minutes,
      note,
      worked_on: d(-back),
      kind,
      created_at: at(-back, 18),
    });
  await ins("console_time_entries", { id: uid("time:previous"), company_id: C.clinica.id, engagement_id: E.cli_suporte.id, author_id: marina.id, minutes: 1080, note: "Atendimentos de setembro", worked_on: `${monthBefore}-15`, kind: "bank", created_at: at(-35) });
  await ins("console_hours_months", { id: uid("hours-month:previous"), company_id: C.clinica.id, month: monthBefore, report_sent_at: at(-21, 9), report_sent_by: kauan.id, updated_at: at(-21, 9) });

  /* ---------- project boards ---------- */

  const assign = { k: kauan, m: marina, r: rafael };
  const boards = {
    cli_portal: [
      ["Acessos", "done", "normal", [], null, -60, "m", null],
      ["Reunião de início", "done", "normal", [], null, -58, "k", null],
      ["Protótipo das telas do paciente", "done", "high", ["design"], 960, -45, "m", null],
      ["Agenda por profissional", "done", "high", ["agenda"], 1800, -20, "r", null],
      ["Cadastro e login do paciente", "review", "high", ["agenda", "login"], 1200, 2, "r", "Código por SMS e senha opcional."],
      ["Campos de convênio no cadastro", "review", "normal", ["cadastro"], 360, 3, "m", "Pedido no chamado do convênio."],
      ["Remarcar e cancelar", "in_progress", "normal", ["agenda"], 720, 6, "r", null],
      ["Lembrete 24 horas antes", "in_progress", "high", ["whatsapp"], 600, 9, "m", "Modelo de mensagem aprovado pela Renata."],
      ["Painel da recepção", "todo", "normal", ["recepção"], 1200, 15, "m", null],
      ["Relatório por profissional", "todo", "low", ["relatórios"], 480, null, null, "Esperando o modelo da recepção."],
      ["Teleconsulta por vídeo", "backlog", "normal", ["aditivo"], null, null, null, "Depende do aditivo."],
      ["Lista de espera para encaixes", "backlog", "low", [], null, null, null, "Pedido da recepção."],
    ],
    mei_agenda: [
      ["Acessos", "todo", "normal", [], null, 2, "k", null],
      ["Reunião de início", "todo", "high", [], null, 4, "k", null],
      ["Horários de atendimento", "backlog", "normal", ["agenda"], 600, null, null, null],
      ["Página de marcação", "backlog", "normal", ["agenda"], 900, null, null, null],
      ["Confirmação ao marcar", "backlog", "normal", ["whatsapp"], 300, null, null, null],
      ["Lembrete no dia anterior", "backlog", "low", ["whatsapp"], 240, null, null, null],
    ],
    rot_app: [
      ["Login do motorista", "done", "normal", [], 480, -260, "r", null],
      ["Rota do dia", "done", "high", [], 1500, -240, "r", null],
      ["Baixa com foto", "done", "normal", [], 900, -220, "m", null],
    ],
    ass_site: [
      ["Páginas institucionais", "in_progress", "normal", ["site"], 900, null, "m", "Parado: faltam os textos."],
      ["Notícias", "todo", "normal", ["site"], 600, null, null, null],
      ["Agenda das feiras", "backlog", "low", ["site"], 480, null, null, null],
    ],
  };
  const taskIds = {};
  for (const [eng, rows] of Object.entries(boards)) {
    const company = C[E[eng].company];
    const positions = {};
    for (const [i, [title, status, priority, labels, estimate, due, who, description]] of rows.entries()) {
      const id = uid(`task:${eng}:${i}`);
      taskIds[`${eng}:${title}`] = id;
      positions[status] = (positions[status] ?? 0) + 1;
      const requested = title === "Lista de espera para encaixes";
      await ins("console_tasks", {
        id,
        engagement_id: E[eng].id,
        company_id: company.id,
        title,
        description,
        status,
        priority,
        due_date: due !== null ? d(due) : null,
        labels,
        estimate_minutes: estimate,
        position: positions[status],
        created_by: requested ? renata.id : kauan.id,
        requested,
        review_since: status === "review" ? at(-1 - i / 10) : null,
        approved_by: status === "done" && eng === "cli_portal" && i > 1 ? renata.id : null,
        approved_at: status === "done" && eng === "cli_portal" && i > 1 ? at(-15 - i) : null,
        created_at: at(eng === "cli_portal" ? -62 : eng === "mei_agenda" ? -6 : -280, 10),
        updated_at: at(status === "done" ? -15 : -1),
      });
      if (who) await ins("console_task_assignees", { task_id: id, user_id: assign[who].id, created_at: at(-30) });
      await ins("console_audit_events", { id: uid(`audit:task-created:${id}`), actor_id: requested ? renata.id : kauan.id, company_id: company.id, action: "task.created", entity_id: id, details: J({ engagementId: E[eng].id, title }), created_at: at(eng === "cli_portal" ? -62 : -6, 10) });
    }
  }
  const moves = [
    ["cli_portal:Agenda por profissional", "in_progress", "review", rafael, -22],
    ["cli_portal:Agenda por profissional", "review", "done", renata, -20],
    ["cli_portal:Cadastro e login do paciente", "in_progress", "review", rafael, -1],
    ["cli_portal:Campos de convênio no cadastro", "in_progress", "review", marina, -0.5],
    ["cli_portal:Lembrete 24 horas antes", "todo", "in_progress", marina, -2],
  ];
  for (const [i, [task, from, to, who, when]] of moves.entries())
    await ins("console_audit_events", { id: uid(`audit:move:${i}`), actor_id: who.id, company_id: C.clinica.id, action: to === "done" && who === renata ? "task.approved" : "task.moved", entity_id: taskIds[task], details: J({ engagementId: E.cli_portal.id, from, to }), created_at: at(when) });
  const comments = [
    ["cli_portal:Cadastro e login do paciente", rafael, -1, "No ambiente de teste já dá para entrar com o código por SMS. Usem um número de vocês para testar."],
    ["cli_portal:Cadastro e login do paciente", renata, -0.6, "Testei com dois celulares. Funcionou nos dois; só o texto do SMS ficou longo."],
    ["cli_portal:Cadastro e login do paciente", rafael, -0.4, "Encurtei para \"Seu código da Clínica Vida Plena é 123456.\""],
    ["cli_portal:Lembrete 24 horas antes", marina, -2, "Modelo de mensagem enviado para aprovação na Meta. A resposta costuma sair em até um dia."],
  ];
  for (const [i, [task, who, when, body]] of comments.entries()) {
    const id = uid(`comment:${i}`);
    await ins("console_task_comments", { id, task_id: taskIds[task], author_id: who.id, body, created_at: at(when) });
    await ins("console_audit_events", { id: uid(`audit:comment:${i}`), actor_id: who.id, company_id: C.clinica.id, action: "task.commented", entity_id: taskIds[task], details: J({ engagementId: E.cli_portal.id }), created_at: at(when) });
  }
  ids.tasks = { review: taskIds["cli_portal:Cadastro e login do paciente"] };

  /* ---------- suspension ---------- */

  await ins("console_engagement_suspensions", {
    id: uid("suspension:rot_hosp"),
    engagement_id: E.rot_hosp.id,
    company_id: C.rotasul.id,
    reason: "overdue",
    note: "Hospedagem de setembro em aberto. Cláudia pediu prazo até o dia 30.",
    scheduled_for: d(6),
    notice_sent_at: at(-1, 10),
    actor_id: kauan.id,
    created_at: at(-1, 10),
  });

  /* ---------- journeys ---------- */

  const briefing = (b) =>
    J({
      notas: "",
      objetivo: "",
      problema: "",
      publico: "",
      tipoProjeto: null,
      funcionalidades: [],
      integracoes: [],
      restricoes: [],
      prazoDesejado: "",
      orcamentoCliente: "",
      decisor: "",
      perguntasAbertas: [],
      riscos: [],
      proximosPassos: [],
      ...b,
    });
  const journeyDefs = {
    mei: {
      title: "Agenda online da Aline Bezerra",
      company: "mei",
      quote: "mei",
      status: "active",
      created: -12,
      briefing: briefing({
        notas: "Ateliê de costura. Hoje marca tudo pelo WhatsApp e perde horários. Quer que a cliente escolha o horário da prova sozinha.",
        objetivo: "As clientes marcam prova e retirada de peças pela internet.",
        problema: "Horários marcados pelo WhatsApp se perdem e a Aline atende fora de hora.",
        publico: "Clientes do ateliê, a maioria pelo celular.",
        tipoProjeto: "sistema",
        funcionalidades: ["Agenda com horários de atendimento", "Confirmação por WhatsApp", "Lembrete no dia anterior", "Lista do dia para o ateliê"],
        restricoes: ["Verba até R$ 5 mil"],
        prazoDesejado: "Antes do fim de novembro",
        orcamentoCliente: "Até R$ 5 mil",
        decisor: "Aline, a dona",
        perguntasAbertas: ["Ela quer cobrar sinal na marcação?"],
        proximosPassos: ["Reunião de início", "Acessos ao domínio"],
      }),
      steps: [
        ["nda", "skipped", {}],
        ["kickoff", "todo", { scheduled: 4 }],
        ["prompt-projeto", "doing", {}],
        ["repositorio", "done", { url: "https://github.com/anuntech/agenda-aline" }],
        ["dominio", "todo", { value: "agenda.alinebezerra.com.br" }],
      ],
    },
    clinica: {
      title: "Portal do paciente da Clínica Vida Plena",
      company: "clinica",
      quote: "clinica",
      status: "active",
      created: -90,
      briefing: briefing({
        objetivo: "O paciente marca, remarca e cancela consultas sozinho.",
        problema: "A recepção passa a manhã ao telefone confirmando consultas.",
        publico: "Pacientes da clínica, de 20 a 70 anos.",
        tipoProjeto: "sistema",
        funcionalidades: ["Agenda por profissional", "Cadastro com convênio", "Lembrete por WhatsApp", "Painel da recepção"],
        integracoes: ["WhatsApp Business API", "SMS"],
        prazoDesejado: "Dezembro",
        decisor: "Renata Moura, administradora",
      }),
      steps: [
        ["kickoff", "done", { scheduled: -58 }],
        ["prompt-projeto", "done", {}],
        ["repositorio", "done", { url: "https://github.com/anuntech/portal-vida-plena" }],
        ["vercel", "done", { url: "https://vercel.com/anuntech/portal-vida-plena" }],
        ["neon", "done", {}],
        ["variaveis", "done", {}],
        ["design-system", "done", {}],
        ["design-aprovado", "done", {}],
        ["dominio", "done", { value: "portal.vidaplena.com.br" }],
        ["cloudflare", "doing", {}],
        ["email-dominio", "skipped", { note: "A clínica já tem e-mail próprio." }],
        ["monitoramento", "todo", {}],
        ["lgpd", "doing", { note: "Termo de uso revisado; falta a política de privacidade." }],
        ["apresentacao", "done", { scheduled: -14, note: "Renata e Paulo aprovaram a agenda. Pediram o convênio no cadastro." }],
        ["revisao", "doing", {}],
      ],
    },
    padaria: {
      title: "Cardápio digital da Padaria Bom Grão",
      company: "padaria",
      quote: "padaria",
      ticket: "pad_cardapio",
      status: "active",
      created: -15,
      briefing: briefing({
        objetivo: "Pedido pela mesa com QR Code, impresso na cozinha.",
        tipoProjeto: "app",
        funcionalidades: ["Cardápio com fotos", "Pedido pela mesa", "Impressão na cozinha"],
        decisor: "João Batista, sócio",
      }),
      steps: [],
    },
    lead: {
      title: "Site da Academia Movimento",
      lead: { name: "Academia Movimento", contact: "Fernanda Lopes", email: "fernanda@academiamovimento.invalid", phone: "48999112233" },
      status: "active",
      created: -3,
      steps: [],
    },
    rotasul: {
      title: "Rastreamento de entregas da Rota Sul",
      company: "rotasul",
      quote: "rotasul",
      status: "lost",
      created: -55,
      finished: -35,
      steps: [],
    },
  };
  const JN = {};
  for (const [key, j] of Object.entries(journeyDefs)) {
    const id = uid(`journey:${key}`);
    JN[key] = id;
    await ins("console_journeys", {
      id,
      title: j.title,
      company_id: j.company ? C[j.company].id : null,
      lead: j.lead ? J(j.lead) : null,
      ticket_id: j.ticket ? TK[j.ticket] : null,
      quote_id: j.quote ? quotes[j.quote].id : null,
      owner_id: kauan.id,
      status: j.status,
      briefing: j.briefing ?? null,
      finished_at: j.finished !== undefined ? at(j.finished) : null,
      created_at: at(j.created, 9),
      updated_at: at(-1),
    });
    for (const [stepKey, status, o] of j.steps)
      await ins("console_journey_steps", {
        id: uid(`journey-step:${key}:${stepKey}`),
        journey_id: id,
        key: stepKey,
        status,
        note: o.note ?? null,
        url: o.url ?? null,
        value: o.value ?? null,
        scheduled_at: o.scheduled !== undefined ? at(o.scheduled, 14) : null,
        assignee_id: status === "doing" || status === "todo" ? kauan.id : null,
        done_by: status === "done" ? kauan.id : null,
        done_at: status === "done" ? at(o.scheduled ?? -5, 16) : null,
        created_at: at(j.created, 9),
        updated_at: at(-1),
      });
  }
  ids.journeys = JN;

  /* ---------- notifications, milestones ---------- */

  await ins("console_notification_preferences", {
    key: `${C.clinica.id}:billing`,
    company_id: C.clinica.id,
    topic: "billing",
    email: "financeiro@vidaplena.invalid",
    phone: "11987650002",
    emails: J(["financeiro@vidaplena.invalid", renata.email]),
    phones: J(["11987650002"]),
    email_enabled: true,
    whatsapp_enabled: true,
  });
  await ins("console_notification_preferences", {
    key: `${C.padaria.id}:billing`,
    company_id: C.padaria.id,
    topic: "billing",
    email: "contato@bomgrao.invalid",
    phone: "",
    email_enabled: true,
    whatsapp_enabled: false,
  });
  await ins("console_notification_preferences", {
    key: `${C.rotasul.id}:tickets`,
    company_id: C.rotasul.id,
    topic: "tickets",
    email: claudia.email,
    phone: "",
    email_enabled: true,
    whatsapp_enabled: false,
  });
  await ins("console_user_milestones", { id: uid("milestone:renata:members"), user_id: renata.id, company_id: C.clinica.id, key: "members_reviewed", created_at: at(-30) });

  /* ---------- bookmarks ---------- */

  const folders = [
    ["anuntech:ferramentas", null, kauan, "Ferramentas da equipe", "company"],
    ["clinica:portal", C.clinica.id, renata, "Portal do paciente", "company"],
    ["clinica:diretoria", C.clinica.id, renata, "Diretoria", "people"],
  ];
  const F = {};
  for (const [key, company, owner, name, visibility] of folders) {
    F[key] = uid(`folder:${key}`);
    await ins("console_bookmark_folders", { id: F[key], company_id: company, owner_id: owner.id, name, visibility, created_at: at(-80) });
  }
  await ins("console_bookmark_folder_shares", { folder_id: F["clinica:diretoria"], user_id: paulo.id, created_at: at(-60) });
  const fakePdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  const bookmarks = [
    ["anuntech:vercel", null, kauan, "anuntech:ferramentas", "Projetos na Vercel", { url: "https://vercel.com/dashboard" }],
    ["anuntech:inter", null, kauan, "anuntech:ferramentas", "Internet Banking Inter Empresas", { url: "https://contadigital.inter.co" }],
    ["anuntech:github", null, marina, "anuntech:ferramentas", "Repositórios no GitHub", { url: "https://github.com/anuntech" }],
    ["anuntech:loose", null, kauan, null, "Checklist de entrega de projeto", { url: "https://www.notion.so" }],
    ["clinica:figma", C.clinica.id, renata, "clinica:portal", "Protótipo no Figma", { url: "https://www.figma.com" }],
    ["clinica:manual", C.clinica.id, renata, "clinica:portal", "Manual da recepção", { file_name: "manual-recepcao.pdf", content: fakePdf }],
    [
      "clinica:lousa",
      C.clinica.id,
      renata,
      "clinica:portal",
      "Fluxo do agendamento",
      { board: J({ type: "excalidraw", version: 2, source: "design-fixtures", elements: [], appState: {}, files: {} }) },
    ],
    ["clinica:planilha", C.clinica.id, renata, "clinica:diretoria", "Metas de atendimento 2026", { url: "https://docs.google.com/spreadsheets" }],
    ["clinica:loose", C.clinica.id, paulo, null, "Tabela de convênios aceitos", { url: "https://www.ans.gov.br" }],
  ];
  const B = {};
  for (const [key, company, owner, folder, title, o] of bookmarks) {
    B[key] = uid(`bookmark:${key}`);
    await ins("console_bookmarks", { id: B[key], company_id: company, author_id: owner.id, folder_id: folder ? F[folder] : null, title, ...o, created_at: at(-50), updated_at: at(-10) });
  }
  ids.bookmarks = { board: B["clinica:lousa"] };

  /* ---------- assistant ---------- */

  const conversation = uid("conversation:atrasos");
  await ins("console_assistant_conversations", { id: conversation, user_id: kauan.id, title: "Faturas em atraso", created_at: at(-1, 9), updated_at: at(-1, 9) });
  await ins("console_assistant_messages", { id: uid("assistant-message:1"), conversation_id: conversation, role: "user", content: "Quais faturas estão em atraso?", created_at: at(-1, 9) });
  await ins("console_assistant_messages", {
    id: uid("assistant-message:2"),
    conversation_id: conversation,
    role: "assistant",
    content:
      "Três faturas estão em atraso:\n\n- Transportes Rota Sul: Hospedagem e e-mail · setembro, R$ 189,00\n- Transportes Rota Sul: Hospedagem e e-mail · outubro, R$ 189,00\n- Clínica Vida Plena: Synova · outubro, R$ 490,00",
    steps: J(["Consultei as faturas"]),
    created_at: at(-1, 9),
  });

  /* ---------- audit trail for the company pages ---------- */

  const audit = [
    [kauan, "mei", "company.created", C.mei.id, -12],
    [kauan, "mei", "quote.sent", quotes.mei.id, -10],
    [kauan, "mei", "contract.sent", K.mei_agenda.id, -5],
    [kauan, "clinica", "contract.sent", K.cli_portal.id, -64],
    [renata, "clinica", "contract.signed", K.cli_portal.id, -62],
  ];
  for (const [i, [who, company, action, entity, when]] of audit.entries())
    await ins("console_audit_events", { id: uid(`audit:${i}:${action}`), actor_id: who.id, company_id: C[company].id, action, entity_id: entity, details: J({}), created_at: at(when) });

  const countText = Object.entries(counts)
    .filter(([k]) => ["companies", "tickets", "messages", "invoices", "quotes", "contracts", "tasks", "journeys", "bookmarks"].includes(k))
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return {
    staff: { token: staffToken, email: staffEmail },
    client: { token: clientToken, email: renata.email, companyId: C.clinica.id },
    ids,
    counts: countText,
  };
}
