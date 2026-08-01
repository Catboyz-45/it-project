import type { AdminRole } from "@prisma/client";

export type Permission = "CMS_READ" | "CMS_WRITE" | "MEDIA_WRITE" | "ADMIN_MANAGE" | "AUDIT_READ" | "PURGE_EARLY";
const permissions: Record<AdminRole, ReadonlySet<Permission>> = {
  EDITOR: new Set(["CMS_READ", "CMS_WRITE", "MEDIA_WRITE"]),
  SUPER_ADMIN: new Set(["CMS_READ", "CMS_WRITE", "MEDIA_WRITE", "ADMIN_MANAGE", "AUDIT_READ", "PURGE_EARLY"]),
};
export function can(role: AdminRole, permission: Permission) { return permissions[role].has(permission); }
