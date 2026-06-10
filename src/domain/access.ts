// Role-based access. Maps a role (DB Role enum or session role) to a data scope
// and capability flags. Used by app-layer authorization and mirrored by RLS.

export type DataScope = "ALL" | "TEAM" | "OWN";

const ALL_ROLES = ["CEO", "ADMIN", "SUPER_ADMIN"];
const TEAM_ROLES = ["SALES_HEAD", "FINANCE", "MARKETING", "LISTINGS"];

export function dataScope(role: string | null | undefined): DataScope {
  const r = String(role ?? "").toUpperCase();
  if (ALL_ROLES.includes(r)) return "ALL";
  if (TEAM_ROLES.includes(r)) return "TEAM"; // can see team data, limited mutations
  return "OWN";
}

export const canSeeAllData = (role?: string | null) => dataScope(role) !== "OWN";
export const canManageSettings = (role?: string | null) =>
  ["CEO", "ADMIN", "SUPER_ADMIN", "SALES_HEAD"].includes(String(role ?? "").toUpperCase());
export const canManageInventory = (role?: string | null) =>
  ["CEO", "ADMIN", "SUPER_ADMIN", "SALES_HEAD", "LISTINGS"].includes(String(role ?? "").toUpperCase());
export const canSeeFinance = (role?: string | null) =>
  ["CEO", "ADMIN", "SUPER_ADMIN", "FINANCE"].includes(String(role ?? "").toUpperCase());

/** Whether a viewer may access a specific agent's owned record. */
export function canAccessOwned(role: string | null | undefined, viewerAgentId: string | null, ownerAgentId: string | null): boolean {
  if (dataScope(role) !== "OWN") return true;
  return !!viewerAgentId && viewerAgentId === ownerAgentId;
}
