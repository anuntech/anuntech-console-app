import { hasPermission, type Role } from "../access/permissions";
import { scopeIncludes, type EngagementScope } from "../access/engagement-scope";

/*
 * A folder can carry a gate on top of who sees it (Arquivos, phase 4d): an
 * area of the company ("finance": the signed contracts the Console files
 * there) or a project (its deliveries; a Member may see only some projects).
 * Pure, so the list, the item, the actions and the tests read one rule. The
 * team passes every gate; a gate never opens a folder its visibility closes.
 */

export type FolderGate = { companyId: string | null; area?: "finance" | null; engagementId?: string | null };
export type GateViewer = { admin: boolean; roles: Record<string, Role>; engagements: Record<string, EngagementScope> };

export function gateOpen(viewer: GateViewer, folder: FolderGate) {
  if (viewer.admin || (!folder.area && !folder.engagementId)) return true;
  const role = folder.companyId ? viewer.roles[folder.companyId] : undefined;
  if (!role) return false;
  if (folder.area && !hasPermission(role, folder.area)) return false;
  if (folder.engagementId && !scopeIncludes(viewer.engagements[folder.companyId!], folder.engagementId)) return false;
  return true;
}

export const gateViewerOf = (actor: { admin: boolean; grants: readonly { company: { id: string }; role: Role; engagements: EngagementScope }[] }): GateViewer => ({
  admin: actor.admin,
  roles: Object.fromEntries(actor.grants.map((g) => [g.company.id, g.role])),
  engagements: Object.fromEntries(actor.grants.map((g) => [g.company.id, g.engagements])),
});

export const hasGate = (folder: FolderGate) => !!folder.area || !!folder.engagementId;
/** The same gate on both: what is behind one may move behind the other. */
export const sameGate = (a: FolderGate, b: FolderGate) => (a.area ?? null) === (b.area ?? null) && (a.engagementId ?? null) === (b.engagementId ?? null);
