/*
 * One "ficha" per contract template: the numbers each template's text
 * promises or asks, with the clause behind every one, read from the
 * templates as rewritten on 14/10/2026 after the legal team's review (all ten
 * are active; the external lawyer has not read them yet). The team starts a company's conditions from one of
 * these and adjusts to what that company actually signed. A value the
 * template leaves as a {{placeholder}} (the hours bank) starts empty and
 * must be filled before publishing.
 */
import type { ServicePolicy } from "./terms-model";

const HOUR = 60;
const DAY = 540;

export type TermsPreset = { key: string; label: string; source: string; policy: ServicePolicy | null };

export const termsPresets: TermsPreset[] = [
  {
    key: "support",
    label: "Suporte e sustentação",
    source: "Modelo Suporte e sustentação",
    policy: {
      levels: true,
      response: {
        critical: { firstResponseMinutes: 4 * HOUR, goalMinutes: DAY },
        high: { firstResponseMinutes: DAY, goalMinutes: 3 * DAY },
        normal: { firstResponseMinutes: 2 * DAY, goalMinutes: 10 * DAY },
      },
      pausesWhileWaiting: true,
      clientResponseDays: 5,
      testDays: 5,
      tacitAcceptance: true,
      hoursBank: { monthlyMinutes: 0, alertPercent: 80, overageCents: null, reportContestDays: 5 },
      improvementBankLimitMinutes: 8 * HOUR,
      improvementWarrantyDays: 60,
      outOfHours: "not_included",
      includesDevelopment: true,
      suspensionDays: 15,
      suspensionNotice: true,
      clauses: {
        channel: "SUP 3.1",
        hours: "SUP 3.2",
        response: "SUP 6.1 e 6.3",
        pausesWhileWaiting: "SUP 6.4 e 8.4",
        clientResponseDays: "SUP 7.1(b)",
        testDays: "SUP 5.3",
        tacitAcceptance: "SUP 5.3",
        hoursBank: "SUP 4.1 a 4.5",
        reportContestDays: "SUP 4.7",
        improvementBankLimitMinutes: "SUP 5.1 e 5.2",
        improvementWarrantyDays: "SUP 5.4",
        outOfHours: "SUP 6.2",
        includesDevelopment: "SUP 2.3",
        suspension: "SUP 8.4",
        approvers: "SUP 3.3",
      },
    },
  },
  {
    key: "synova",
    label: "Licença Synova",
    source: "Modelo Licença de uso do Synova (ativo)",
    policy: {
      levels: false,
      response: { normal: { firstResponseMinutes: DAY } },
      pausesWhileWaiting: false,
      tacitAcceptance: false,
      outOfHours: "unspecified",
      includesDevelopment: false,
      suspensionDays: 15,
      suspensionNotice: true,
      clauses: { channel: "SYN 9.1", hours: "SYN 3.4 e 9.1", response: "SYN 9.1", suspension: "SYN 5.4" },
    },
  },
  {
    key: "saas",
    label: "Licença SaaS",
    source: "Modelo Licença SaaS",
    policy: {
      levels: false,
      response: { normal: { firstResponseMinutes: DAY } },
      pausesWhileWaiting: false,
      tacitAcceptance: false,
      outOfHours: "unspecified",
      includesDevelopment: false,
      suspensionDays: 15,
      suspensionNotice: true,
      clauses: { channel: "SAAS 10.1", hours: "SAAS 3.4 e 10.1", response: "SAAS 10.1", includesDevelopment: "SAAS 2.4 e 10.1", suspension: "SAAS 6.2" },
    },
  },
  {
    key: "infra",
    label: "Infraestrutura em nuvem",
    source: "Modelo Infraestrutura em nuvem",
    policy: {
      levels: false,
      response: { normal: { firstResponseMinutes: DAY } },
      outageFirstResponseMinutes: 4 * HOUR,
      pausesWhileWaiting: false,
      tacitAcceptance: false,
      outOfHours: "if_contracted",
      includesDevelopment: false,
      suspensionDays: 15,
      suspensionNotice: true,
      clauses: { channel: "INFRA 8.5", hours: "INFRA 2.6 e 8.5", response: "INFRA 8.5", outOfHours: "INFRA 8.5", includesDevelopment: "INFRA 2.4", suspension: "INFRA 5.4" },
    },
  },
  {
    key: "email",
    label: "E-mail corporativo",
    source: "Modelo E-mail corporativo",
    policy: {
      levels: false,
      response: { normal: { firstResponseMinutes: DAY } },
      outageFirstResponseMinutes: 4 * HOUR,
      pausesWhileWaiting: false,
      tacitAcceptance: false,
      outOfHours: "unspecified",
      includesDevelopment: false,
      suspensionDays: 15,
      suspensionNotice: true,
      clauses: { channel: "EMAIL 7.1", hours: "EMAIL 7.1", response: "EMAIL 7.1", suspension: "EMAIL 4.6" },
    },
  },
  {
    key: "service",
    label: "Serviço pontual (garantia)",
    source: "Modelo Serviço técnico com escopo fechado",
    policy: {
      levels: false,
      response: { normal: { firstResponseMinutes: DAY } },
      pausesWhileWaiting: false,
      clientResponseDays: 5,
      testDays: 5,
      tacitAcceptance: true,
      outOfHours: "unspecified",
      includesDevelopment: false,
      warrantyUntil: null,
      clauses: { response: "Serviço 7.1", clientResponseDays: "Serviço 3.3", testDays: "Serviço 4.2", tacitAcceptance: "Serviço 4.4", warrantyUntil: "Serviço 7.1" },
    },
  },
  { key: "custom", label: "Outro contrato", source: "Contrato próprio da empresa", policy: null },
];

/**
 * The ficha behind a contract template, by the template's name (the names in
 * the database are not the fichas' labels: "Suporte técnico e sustentação de
 * sistemas" is "Suporte e sustentação"). Null for templates with no ficha
 * (development, consulting, squad, confidentiality).
 */
export function presetForTemplate(name: string | null | undefined): string | null {
  if (!name) return null;
  const text = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/synova/.test(text)) return "synova";
  if (/suporte|sustentacao/.test(text)) return "support";
  if (/saas|licenca de uso de software/.test(text)) return "saas";
  if (/infraestrutura|nuvem/.test(text)) return "infra";
  if (/e-?mail/.test(text)) return "email";
  if (/escopo fechado|servico tecnico/.test(text)) return "service";
  return null;
}

/** A fresh copy of a preset's policy (null for "custom" and unknown keys). */
export function presetPolicy(key: string): ServicePolicy | null {
  const preset = termsPresets.find((p) => p.key === key);
  return preset?.policy ? (JSON.parse(JSON.stringify(preset.policy)) as ServicePolicy) : null;
}

/** An empty policy for an external contract the team transcribes by hand. */
export function blankPolicy(): ServicePolicy {
  return {
    levels: false,
    response: {},
    pausesWhileWaiting: false,
    tacitAcceptance: false,
    outOfHours: "unspecified",
    includesDevelopment: false,
    clauses: {},
  };
}
