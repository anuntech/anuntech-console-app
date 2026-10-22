import { useQuery } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { api } from "./api";

/*
 * What the company's Administrador manages from the app: Dados da empresa,
 * Membros and Notificações. The server decides who may (me.managedCompanyId
 * tells the app); these are the shared queries and routes.
 */
export const companyKey = ["company"] as const;
export const membersKey = ["members"] as const;
export const notificationsKey = ["notifications"] as const;
export const noticeHistoryKey = ["notifications", "history"] as const;

export type MemberList = Awaited<ReturnType<typeof api.members.list>>;
export type Person = MemberList["people"][number];
export type ScopeChoice = MemberList["choices"][number];
export type MemberScope = Person["scope"];
export type Role = Person["role"];

/** The company's people and what a Membro can be given to see (members.list). */
export function useMembers() {
  return useQuery({ queryKey: membersKey, queryFn: () => api.members.list({}) });
}

/*
 * The typed-routes file (.expo/types) is written by `expo start`; until it
 * runs again it does not know these screens, so their paths go through here.
 */
const href = (path: string) => path as Href;
export const managerRoutes = {
  invite: href("/conta/membros/convidar"),
  person: (key: string) => href(`/conta/membros/${encodeURIComponent(key)}`),
};

/** Administrador in violet, Membro in grey, as the web's badges. */
export const roleTone = (role: Role) => (role === "manager" ? "info" : "neutral") as "info" | "neutral";
