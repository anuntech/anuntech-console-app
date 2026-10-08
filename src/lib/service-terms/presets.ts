/*
 * One "ficha" per contract template: the numbers each template's text
 * promises or asks, with the clause behind every one, read from the
 * templates as they stand (October 2026; only Synova is active, the others
 * wait for the lawyer). The team starts a company's conditions from one of
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
        channel: "SUP 2.1",
        hours: "SUP 2.2",
        response: "SUP 5.1 e 5.2",
        pausesWhileWaiting: "SUP 5.3 e 7.3",
        clientResponseDays: "SUP 6.1(b)",
        testDays: "SUP 4.3",
        tacitAcceptance: "SUP 4.3",
        hoursBank: "SUP 3.1 a 3.3",
        reportContestDays: "SUP 3.4",
        improvementBankLimitMinutes: "SUP 4.1 e 4.2",
        improvementWarrantyDays: "SUP 4.4",
        outOfHours: "SUP 1.4",
        includesDevelopment: "SUP 1.3",
        suspension: "SUP 7.3",
        approvers: "SUP 2.3",
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
      suspensionNotice: false,
      clauses: { channel: "SYN 5.1", hours: "SYN 5.1", response: "SYN 5.1", suspension: "SYN 3.3" },
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
      clauses: { channel: "SAAS 6.1", hours: "SAAS 2.4 e 6.1", response: "SAAS 6.1", includesDevelopment: "SAAS 1.4 e 6.1", suspension: "SAAS 4.3" },
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
      clauses: { channel: "INFRA 6.4", hours: "INFRA 2.3 e 6.4", response: "INFRA 6.4", outOfHours: "INFRA 6.4", includesDevelopment: "INFRA 1.4", suspension: "INFRA 4.3" },
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
      clauses: { channel: "EMAIL 5.1", hours: "EMAIL 2.4 e 5.1", response: "EMAIL 5.1", suspension: "EMAIL 3.4" },
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
      clauses: { response: "Serviço 5.1", clientResponseDays: "Serviço 2.3", testDays: "Serviço 3.2", tacitAcceptance: "Serviço 3.4", warrantyUntil: "Serviço 5.1" },
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
